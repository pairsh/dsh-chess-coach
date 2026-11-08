/**
 * Read-only bridge to a local En Croissant installation.
 *
 * En Croissant is a Tauri application: it exposes no HTTP or CLI API, so the
 * only stable integration surface is the files it already owns. This module
 * reads `engines/engines.json`, the SQLite `.db3` databases, and the `.pgn`
 * sidecar when one exists. It never writes to the En Croissant data directory.
 *
 * The one format intentionally not decoded is the `Games.Moves` BLOB. It is a
 * one-byte legal-move index whose ordering belongs to En Croissant's Rust move
 * generator; guessing it would silently load the wrong game. Games are loaded
 * from a matching PGN sidecar, or from Lichess when the database stores a
 * Lichess game URL.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type {
  EngineDescriptor,
  EnCroissantDatabase,
  EnCroissantGame,
  EnCroissantGamesResponse,
  EnCroissantGameResponse,
  EnCroissantStatus,
} from '../shared/types.ts'

interface SqliteDatabase {
  prepare(sql: string): {
    all(...params: unknown[]): Record<string, unknown>[]
    get(...params: unknown[]): Record<string, unknown> | undefined
  }
  close(): void
}

interface SqliteModule {
  DatabaseSync: new (file: string, options?: { readOnly?: boolean }) => SqliteDatabase
}

export interface EnCroissantConfig {
  readonly dataDir?: string
  readonly appPath?: string
}

export interface GameFilters {
  readonly player?: string
  readonly event?: string
  readonly result?: string
  readonly after?: string
  readonly before?: string
  readonly limit?: number
  readonly offset?: number
}

interface PgnGame {
  readonly headers: Record<string, string>
  readonly pgn: string
}

interface DbRow {
  readonly id: number
  readonly white: string
  readonly black: string
  readonly whiteElo?: number
  readonly blackElo?: number
  readonly result: string
  readonly date?: string
  readonly event?: string
  readonly site?: string
  readonly timeControl?: string
  readonly eco?: string
  readonly plyCount?: number
}

export class EnCroissantError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'EnCroissantError'
    this.code = code
    this.status = status
  }
}

function exists(file: string | undefined): boolean {
  if (!file) return false
  try {
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

function isDirectory(dir: string | undefined): boolean {
  if (!dir) return false
  try {
    return fs.statSync(dir).isDirectory()
  } catch {
    return false
  }
}

function windowsDriveCandidates(): string[] {
  if (process.platform !== 'win32') return []
  const out: string[] = []
  for (const drive of ['C', 'D', 'E', 'F']) {
    out.push(`${drive}:\\en-croissant\\en-croissant.exe`)
    out.push(`${drive}:\\Program Files\\En Croissant\\en-croissant.exe`)
  }
  return out
}

function appCandidates(configured?: string): string[] {
  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local')
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
  return [
    configured ?? '',
    process.env.EN_CROISSANT_APP ?? '',
    path.join(local, 'Programs', 'en-croissant', 'en-croissant.exe'),
    path.join(local, 'En Croissant', 'en-croissant.exe'),
    path.join(programFiles, 'En Croissant', 'en-croissant.exe'),
    ...windowsDriveCandidates(),
    '/Applications/En Croissant.app/Contents/MacOS/en-croissant',
    '/usr/bin/en-croissant',
    path.join(os.homedir(), '.local', 'bin', 'en-croissant'),
  ]
}

function dataDirCandidates(configured?: string): string[] {
  const home = os.homedir()
  if (process.platform === 'win32') {
    return [
      configured ?? '',
      process.env.EN_CROISSANT_DATA_DIR ?? '',
      path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'org.encroissant.app'),
      path.join(home, 'AppData', 'Roaming', 'org.encroissant.app'),
    ]
  }
  if (process.platform === 'darwin') {
    return [
      configured ?? '',
      process.env.EN_CROISSANT_DATA_DIR ?? '',
      path.join(home, 'Library', 'Application Support', 'org.encroissant.app'),
    ]
  }
  return [
    configured ?? '',
    process.env.EN_CROISSANT_DATA_DIR ?? '',
    path.join(process.env.XDG_DATA_HOME ?? path.join(home, '.local', 'share'), 'org.encroissant.app'),
  ]
}

function firstExisting(candidates: readonly string[], directory = false): string | undefined {
  for (const candidate of candidates) {
    if (!candidate) continue
    if (directory ? isDirectory(candidate) : exists(candidate)) return candidate
  }
  return undefined
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const match of pgn.matchAll(/^\[([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm)) {
    headers[match[1]!] = (match[2] ?? '').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  return headers
}

function splitPgnGames(text: string): PgnGame[] {
  const clean = text.replace(/^\uFEFF/, '')
  const chunks = clean.split(/(?=^\[Event\s+")/m)
  const games: PgnGame[] = []
  for (const chunk of chunks) {
    const pgn = chunk.trim()
    if (!pgn.includes('[White ') || !pgn.includes('[Black ')) continue
    games.push({ headers: parseHeaders(pgn), pgn })
  }
  return games
}

function lichessGameId(site: string | undefined): string | undefined {
  if (!site) return undefined
  const match = /lichess\.org\/(?:game\/)?([A-Za-z0-9]{8,12})/i.exec(site)
  return match?.[1]
}

function rowToGame(row: Record<string, unknown>, hasPgn: boolean): EnCroissantGame {
  const site = typeof row.site === 'string' ? row.site : undefined
  return {
    id: Number(row.id),
    white: String(row.white ?? '?'),
    black: String(row.black ?? '?'),
    ...(typeof row.whiteElo === 'number' ? { whiteElo: row.whiteElo } : {}),
    ...(typeof row.blackElo === 'number' ? { blackElo: row.blackElo } : {}),
    result: String(row.result ?? '*'),
    ...(typeof row.date === 'string' && row.date ? { date: row.date } : {}),
    ...(typeof row.event === 'string' && row.event ? { event: row.event } : {}),
    ...(site ? { site } : {}),
    ...(site && /^https?:\/\//i.test(site) ? { siteUrl: site } : {}),
    ...(typeof row.timeControl === 'string' && row.timeControl ? { timeControl: row.timeControl } : {}),
    ...(typeof row.eco === 'string' && row.eco ? { eco: row.eco } : {}),
    ...(typeof row.plyCount === 'number' ? { plyCount: row.plyCount } : {}),
    pgnSidecar: hasPgn,
  }
}

export class EnCroissantService {
  private readonly config: EnCroissantConfig
  private sqlite: Promise<SqliteModule> | null = null
  private readonly pgnCache = new Map<string, { mtimeMs: number; games: PgnGame[] }>()
  private readonly lichessPgnCache = new Map<string, string>()

  constructor(config: EnCroissantConfig = {}) {
    this.config = config
  }

  dataDir(): string {
    return firstExisting(dataDirCandidates(this.config.dataDir), true)
      ?? this.config.dataDir
      ?? dataDirCandidates(this.config.dataDir).find((candidate) => candidate !== '')!
  }

  appPath(): string | undefined {
    return firstExisting(appCandidates(this.config.appPath))
  }

  private async sqliteModule(): Promise<SqliteModule> {
    if (!this.sqlite) {
      this.sqlite = import('node:sqlite') as unknown as Promise<SqliteModule>
    }
    return this.sqlite
  }

  private async databaseFile(id: string): Promise<string> {
    if (!/^[^/\\]+$/.test(id)) throw new EnCroissantError('bad-database', '数据库名称不合法。')
    const file = path.join(this.dataDir(), 'db', id)
    if (!exists(file)) throw new EnCroissantError('database-not-found', `找不到 En Croissant 数据库：${id}`, 404)
    return file
  }

  private pgnSidecarFor(file: string): string | undefined {
    const dir = path.dirname(file)
    const stem = path.basename(file, path.extname(file)).toLowerCase()
    try {
      const match = fs.readdirSync(dir).find((name) => name.toLowerCase() === `${stem}.pgn`)
      return match ? path.join(dir, match) : undefined
    } catch {
      return undefined
    }
  }

  private async withDatabase<T>(file: string, run: (db: SqliteDatabase) => T): Promise<T> {
    const sqlite = await this.sqliteModule()
    const db = new sqlite.DatabaseSync(file, { readOnly: true })
    try {
      return run(db)
    } finally {
      db.close()
    }
  }

  /** Read the local engine definitions En Croissant manages. */
  engines(): EngineDescriptor[] {
    const file = path.join(this.dataDir(), 'engines', 'engines.json')
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        type?: string
        name?: string
        path?: string
        version?: string
        settings?: { name?: string; value?: string | number | boolean }[]
      }[]
      const out: EngineDescriptor[] = []
      const seen = new Set<string>()
      for (const engine of parsed) {
        if (engine.type !== 'local' || typeof engine.path !== 'string' || !exists(engine.path)) continue
        const key = path.resolve(engine.path).toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        const name = engine.name ?? path.basename(engine.path)
        const kind = /lc0|leela/i.test(`${name} ${engine.path}`)
          ? 'lc0'
          : /stockfish/i.test(`${name} ${engine.path}`)
            ? 'stockfish'
            : 'other'
        // Lc0 needs a weights file and backend arguments that En Croissant
        // supplies outside engines.json. Do not offer a half-configured Lc0.
        if (kind === 'lc0') continue
        const options: Record<string, string | number | boolean> = {}
        for (const setting of engine.settings ?? []) {
          if (setting.name && setting.value !== undefined) options[setting.name] = setting.value
        }
        out.push({
          path: engine.path,
          label: name,
          name,
          ...(engine.version ? { version: engine.version } : {}),
          source: 'en-croissant',
          kind,
          ...(Object.keys(options).length ? { options } : {}),
        })
      }
      const rank = (engine: EngineDescriptor): number => engine.kind === 'stockfish' ? 0 : engine.kind === 'other' ? 1 : 2
      return out.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label))
    } catch {
      return []
    }
  }

  private async databases(): Promise<EnCroissantDatabase[]> {
    const dir = path.join(this.dataDir(), 'db')
    let files: string[] = []
    try {
      files = fs.readdirSync(dir)
    } catch {
      return []
    }
    const sidecars = new Map<string, string>()
    for (const file of files) {
      if (/\.pgn$/i.test(file)) sidecars.set(path.basename(file, path.extname(file)).toLowerCase(), path.join(dir, file))
    }
    const out: EnCroissantDatabase[] = []
    for (const file of files.filter((name) => /\.db3$/i.test(name)).sort()) {
      const filePath = path.join(dir, file)
      const id = file
      const stem = path.basename(file, path.extname(file)).toLowerCase()
      const sidecar = sidecars.get(stem)
      if (!/\.db3$/i.test(file)) continue
      try {
        const stat = fs.statSync(filePath)
        const info = await this.withDatabase(filePath, (db) => {
          const rows = db.prepare('SELECT Name, Value FROM Info').all()
          const map: Record<string, string> = {}
          for (const row of rows) map[String(row.Name)] = String(row.Value ?? '')
          return map
        })
        out.push({
          id,
          title: info.Title || path.basename(file, '.db3'),
          description: info.Description ?? '',
          gameCount: Number.parseInt(info.GameCount ?? '0', 10) || 0,
          playerCount: Number.parseInt(info.PlayerCount ?? '0', 10) || 0,
          path: filePath,
          sizeBytes: stat.size,
          pgnSidecar: Boolean(sidecar),
          readable: true,
        })
      } catch (error) {
        out.push({
          id,
          title: path.basename(file, '.db3'),
          description: '',
          gameCount: 0,
          playerCount: 0,
          path: filePath,
          sizeBytes: 0,
          pgnSidecar: Boolean(sidecar),
          readable: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    // Personal databases (with a PGN sidecar) first, then the smallest masters
    // databases, so opening the tab does not start with a 5M-game archive.
    return out.sort((a, b) =>
      Number(b.pgnSidecar) - Number(a.pgnSidecar)
      || a.gameCount - b.gameCount
      || a.title.localeCompare(b.title),
    )
  }

  /** Inspect the installation and its read-only databases. */
  async status(): Promise<EnCroissantStatus> {
    const dataDir = this.dataDir()
    const appPath = this.appPath()
    if (!isDirectory(dataDir)) {
      return {
        installed: false,
        dataDir,
        databases: [],
        engines: [],
        ...(appPath ? { appPath } : {}),
        error: '没有找到 En Croissant 数据目录。',
      }
    }
    try {
      const databases = await this.databases()
      const engines = this.engines()
      return {
        installed: true,
        dataDir,
        databases,
        engines,
        ...(appPath ? { appPath } : {}),
      }
    } catch (error) {
      return {
        installed: true,
        dataDir,
        databases: [],
        engines: [],
        ...(appPath ? { appPath } : {}),
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Query game headers from one database. The move BLOB is deliberately not
   * read; it is not possible to decode it without reproducing En Croissant's
   * Rust move ordering.
   */
  async games(database: string, filters: GameFilters = {}): Promise<EnCroissantGamesResponse> {
    const file = await this.databaseFile(database)
    const sidecar = this.pgnSidecarFor(file)
    const limit = Math.max(1, Math.min(100, Math.round(filters.limit ?? 30)))
    const offset = Math.max(0, Math.min(100_000, Math.round(filters.offset ?? 0)))
    const where: string[] = []
    const params: unknown[] = []
    if (filters.player?.trim()) {
      where.push('(pw.Name LIKE ? COLLATE NOCASE OR pb.Name LIKE ? COLLATE NOCASE)')
      const like = `%${filters.player.trim()}%`
      params.push(like, like)
    }
    if (filters.event?.trim()) {
      where.push('e.Name LIKE ? COLLATE NOCASE')
      params.push(`%${filters.event.trim()}%`)
    }
    if (filters.result && ['1-0', '0-1', '1/2-1/2', '*'].includes(filters.result)) {
      where.push('g.Result = ?')
      params.push(filters.result)
    }
    if (filters.after && /^\d{4}\.\d{2}\.\d{2}$/.test(filters.after)) {
      where.push('g.Date >= ?')
      params.push(filters.after)
    }
    if (filters.before && /^\d{4}\.\d{2}\.\d{2}$/.test(filters.before)) {
      where.push('g.Date <= ?')
      params.push(filters.before)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = await this.withDatabase(file, (db) => db.prepare(`
      SELECT g.ID AS id,
             COALESCE(pw.Name, '?') AS white,
             COALESCE(pb.Name, '?') AS black,
             g.WhiteElo AS whiteElo,
             g.BlackElo AS blackElo,
             g.Result AS result,
             g.Date AS date,
             e.Name AS event,
             s.Name AS site,
             g.TimeControl AS timeControl,
             g.ECO AS eco,
             g.PlyCount AS plyCount
      FROM Games g
      LEFT JOIN Players pw ON pw.ID = g.WhiteID
      LEFT JOIN Players pb ON pb.ID = g.BlackID
      LEFT JOIN Events e ON e.ID = g.EventID
      LEFT JOIN Sites s ON s.ID = g.SiteID
      ${whereSql}
      ORDER BY g.ID DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset))
    const games = rows.map((row) => rowToGame(row, Boolean(sidecar)))
    return {
      ok: true,
      database,
      games,
      returned: games.length,
    }
  }

  private sidecarGames(file: string): PgnGame[] {
    let stat: fs.Stats
    try {
      stat = fs.statSync(file)
    } catch {
      return []
    }
    const cached = this.pgnCache.get(file)
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.games
    const games = splitPgnGames(fs.readFileSync(file, 'utf8'))
    this.pgnCache.set(file, { mtimeMs: stat.mtimeMs, games })
    return games
  }

  private findSidecarGame(dbFile: string, row: DbRow): PgnGame | undefined {
    const sidecar = this.pgnSidecarFor(dbFile)
    if (!sidecar) return undefined
    const games = this.sidecarGames(sidecar)
    const white = normalizeText(row.white)
    const black = normalizeText(row.black)
    const result = normalizeText(row.result)
    const date = normalizeText(row.date)
    let fallback: PgnGame | undefined
    for (const game of games) {
      if (normalizeText(game.headers.White) !== white) continue
      if (normalizeText(game.headers.Black) !== black) continue
      if (normalizeText(game.headers.Result) !== result) continue
      if (date && normalizeText(game.headers.Date) === date) return game
      if (!fallback) fallback = game
    }
    return fallback
  }

  private async rowForGame(file: string, id: number): Promise<DbRow> {
    const row = await this.withDatabase(file, (db) => db.prepare(`
      SELECT g.ID AS id,
             COALESCE(pw.Name, '?') AS white,
             COALESCE(pb.Name, '?') AS black,
             g.WhiteElo AS whiteElo,
             g.BlackElo AS blackElo,
             g.Result AS result,
             g.Date AS date,
             e.Name AS event,
             s.Name AS site,
             g.TimeControl AS timeControl,
             g.ECO AS eco,
             g.PlyCount AS plyCount
      FROM Games g
      LEFT JOIN Players pw ON pw.ID = g.WhiteID
      LEFT JOIN Players pb ON pb.ID = g.BlackID
      LEFT JOIN Events e ON e.ID = g.EventID
      LEFT JOIN Sites s ON s.ID = g.SiteID
      WHERE g.ID = ?
      LIMIT 1
    `).get(id))
    if (!row) throw new EnCroissantError('game-not-found', `数据库中没有 ID 为 ${id} 的对局。`, 404)
    return row as unknown as DbRow
  }

  private async lichessPgn(id: string): Promise<string | undefined> {
    const cached = this.lichessPgnCache.get(id)
    if (cached) return cached
    try {
      const response = await fetch(`https://lichess.org/game/export/${encodeURIComponent(id)}?evals=0&clocks=0&literate=0`, {
        headers: { accept: 'application/x-chess-pgn', 'user-agent': 'dsh-chess-coach/0.2.0' },
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) return undefined
      const text = await response.text()
      if (!text.trimStart().startsWith('[Event ')) return undefined
      this.lichessPgnCache.set(id, text)
      return text
    } catch {
      return undefined
    }
  }

  /**
   * Load one game as PGN. Preference order:
   * 1. the matching game in the `.pgn` sidecar;
   * 2. the Lichess export API when the database stores a Lichess game URL.
   * The binary `Moves` column is never guessed.
   */
  async game(database: string, id: number): Promise<EnCroissantGameResponse> {
    const file = await this.databaseFile(database)
    const row = await this.rowForGame(file, id)
    const sidecarGame = this.findSidecarGame(file, row)
    if (sidecarGame) {
      return {
        ok: true,
        database,
        id,
        source: 'sidecar',
        pgn: sidecarGame.pgn,
        headers: sidecarGame.headers,
      }
    }
    const lichessId = lichessGameId(row.site)
    if (lichessId) {
      const pgn = await this.lichessPgn(lichessId)
      if (pgn) {
        return {
          ok: true,
          database,
          id,
          source: 'lichess',
          pgn,
          headers: parseHeaders(pgn),
        }
      }
    }
    const reason = this.pgnSidecarFor(file)
      ? 'PGN 附属文件里没有找到这场对局（En Croissant 的 .pgn 是导入时的快照，可能已漂移）。'
      : '这个数据库没有 PGN 附属文件，且对局没有 Lichess 链接；En Croissant 的 Moves 是二进制索引，无法安全解码。'
    throw new EnCroissantError('pgn-unavailable', reason, 409)
  }

  /** Open the detected En Croissant app. Fixed path only, no shell. */
  launch(): boolean {
    const app = this.appPath()
    if (!app) throw new EnCroissantError('app-not-found', '没有找到 En Croissant 可执行文件。', 404)
    const child = spawn(app, [], { detached: true, stdio: 'ignore', windowsHide: false })
    child.unref()
    return true
  }
}
