/**
 * A small, dependency-free UCI client for a local Stockfish process.
 *
 * One engine process is kept alive and reused. A new analysis stops the
 * previous search first, so dragging pieces in the UI never builds a queue of
 * stale searches. The service is deliberately conservative about which
 * executables it will run: only paths it discovered itself, a path supplied by
 * the profile config, or an environment override can become the engine.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Chess } from 'chess.js'
import type {
  AnalyzeRequest,
  EngineDescriptor,
  EngineLine,
  EngineStatus,
} from '../shared/types.ts'
import { normalizePv, uciToSan } from './coach.ts'

const MAX_LINES = 5
const MAX_DEPTH = 30
const MIN_DEPTH = 4
const MAX_MOVETIME = 20_000
const START_TIMEOUT = 8_000
const CANCEL_TIMEOUT = 900

interface SearchState {
  readonly fen: string
  readonly turn: 'w' | 'b'
  readonly startedAt: number
  readonly lines: Map<number, RawLine>
  depth: number
  nodes: number
  nps: number
  bestmove: string | null
  done: boolean
  cancelled: boolean
  resolve: (value: SearchResult) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
  donePromise: Promise<void>
  markDone: () => void
}

interface RawLine {
  multipv: number
  depth: number
  cp?: number
  mate?: number
  pv: string[]
}

export interface SearchResult {
  readonly fen: string
  readonly turn: 'w' | 'b'
  readonly bestmove: string | null
  readonly depth: number
  readonly nodes: number
  readonly nps: number
  readonly timeMs: number
  readonly lines: EngineLine[]
}

export interface EngineConfig {
  readonly enginePath?: string
  readonly threads?: number
  readonly hashMb?: number
  readonly stateFile?: string
}

class EngineError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'EngineError'
    this.code = code
  }
}

function uniquePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of paths) {
    if (!item) continue
    const resolved = path.resolve(item)
    const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved
    if (seen.has(key)) continue
    seen.add(key)
    out.push(resolved)
  }
  return out
}

function executableNames(): string[] {
  return process.platform === 'win32' ? ['stockfish.exe'] : ['stockfish']
}

function pathExecutables(): string[] {
  const out: string[] = []
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue
    for (const name of executableNames()) out.push(path.join(dir, name))
  }
  return out
}

function encroissantCandidates(): string[] {
  if (process.platform !== 'win32') return []
  const root = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'org.encroissant.app', 'engines', 'stockfish')
  try {
    return fs
      .readdirSync(root)
      .filter((name) => /^stockfish.*\.exe$/i.test(name))
      .sort((a, b) => {
        const score = (name: string): number => /avx2/i.test(name) ? 3 : /bmi2/i.test(name) ? 2 : /sse41-popcnt/i.test(name) ? 1 : 0
        return score(b) - score(a) || a.localeCompare(b)
      })
      .map((name) => path.join(root, name))
  } catch {
    return []
  }
}

function commonCandidates(): string[] {
  const home = os.homedir()
  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
    const local = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local')
    return [
      path.join(programFiles, 'Stockfish', 'stockfish.exe'),
      path.join(programFiles, 'stockfish', 'stockfish.exe'),
      path.join(local, 'Programs', 'Stockfish', 'stockfish.exe'),
      path.join(local, 'Stockfish', 'stockfish.exe'),
      path.join(home, 'stockfish', 'stockfish.exe'),
    ]
  }
  return [
    '/usr/games/stockfish',
    '/usr/local/bin/stockfish',
    '/opt/homebrew/bin/stockfish',
    '/usr/bin/stockfish',
    path.join(home, 'stockfish', 'stockfish'),
  ]
}

/**
 * Find plausible Stockfish executables without running any of them.
 * @param configured - explicit profile config path, tried first.
 * @returns existing files, configured path first.
 */
export function discoverStockfish(configured?: string): EngineDescriptor[] {
  const explicit = [
    configured ?? '',
    process.env.DSH_CHESS_STOCKFISH ?? '',
    process.env.STOCKFISH_BIN ?? '',
    ...encroissantCandidates(),
    ...pathExecutables(),
    ...commonCandidates(),
  ]
  const found: EngineDescriptor[] = []
  for (const file of uniquePaths(explicit)) {
    try {
      if (!fs.statSync(file).isFile()) continue
      found.push({
        path: file,
        label: path.basename(file),
      })
    } catch {
      // Missing candidate: not an error, discovery just continues.
    }
  }
  return found
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.round(number)))
}

function parseInfo(line: string): RawLine | null {
  const tokens = line.split(/\s+/)
  if (tokens[0] !== 'info') return null
  let depth = 0
  let multipv = 1
  let cp: number | undefined
  let mate: number | undefined
  let pvStart = -1
  for (let index = 1; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === 'depth') depth = Number(tokens[++index])
    else if (token === 'multipv') multipv = Number(tokens[++index])
    else if (token === 'score') {
      const kind = tokens[++index]
      const value = Number(tokens[++index])
      if (kind === 'cp' && Number.isFinite(value)) cp = value
      if (kind === 'mate' && Number.isFinite(value)) mate = value
    } else if (token === 'pv') {
      pvStart = index + 1
      break
    }
  }
  if (pvStart < 0) return null
  const pv = tokens.slice(pvStart).filter((move) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)).slice(0, 14)
  if (pv.length === 0) return null
  if (cp === undefined && mate === undefined) return null
  return { multipv: Number.isFinite(multipv) ? Math.max(1, Math.min(MAX_LINES, multipv)) : 1, depth, ...(cp === undefined ? {} : { cp }), ...(mate === undefined ? {} : { mate }), pv }
}

function scoreLine(raw: RawLine, turn: 'w' | 'b'): EngineLine {
  const sign = turn === 'w' ? 1 : -1
  const whiteCp = raw.cp === undefined ? undefined : raw.cp * sign
  const whiteMate = raw.mate === undefined ? undefined : raw.mate * sign
  return {
    multipv: raw.multipv,
    depth: raw.depth,
    ...(raw.cp === undefined ? {} : { cp: raw.cp }),
    ...(raw.mate === undefined ? {} : { mate: raw.mate }),
    ...(whiteCp === undefined ? {} : { whiteCp }),
    ...(whiteMate === undefined ? {} : { whiteMate }),
    pvUci: raw.pv,
    pvSan: [],
  }
}

/**
 * The long-lived Stockfish service exposed by the host plugin.
 */
export class StockfishService {
  private readonly config: EngineConfig
  private readonly stateFile: string
  private selectedPath: string | undefined
  private proc: ChildProcessWithoutNullStreams | null = null
  private output = ''
  private stderr = ''
  private starting: Promise<void> | null = null
  private analysisLock: Promise<void> = Promise.resolve()
  private search: SearchState | null = null
  private waiters: { test: (line: string) => boolean; resolve: (line: string) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }[] = []
  private version = ''
  private name = 'Stockfish'
  private state: EngineStatus['state'] = 'unavailable'
  private lastError = ''
  private disposed = false

  constructor(config: EngineConfig = {}) {
    this.config = config
    this.stateFile = config.stateFile ?? path.join(process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh'), 'dsh-chess-coach.json')
    this.selectedPath = this.loadSelectedPath()
  }

  private loadSelectedPath(): string | undefined {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFile, 'utf8')) as { enginePath?: unknown }
      if (typeof parsed.enginePath === 'string') return parsed.enginePath
    } catch {
      // First run, unreadable state, or user removed the file.
    }
    return undefined
  }

  private saveSelectedPath(file: string): void {
    try {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true })
      fs.writeFileSync(this.stateFile, `${JSON.stringify({ enginePath: file }, null, 2)}\n`, 'utf8')
    } catch {
      // Persisting a preference is best-effort; the engine still works.
    }
  }

  candidates(): EngineDescriptor[] {
    const configured = this.config.enginePath?.trim() || this.selectedPath
    return discoverStockfish(configured)
  }

  status(): EngineStatus {
    const candidates = this.candidates()
    return {
      available: this.state === 'ready',
      state: this.state,
      name: this.name,
      ...(this.version ? { version: this.version } : {}),
      ...(this.selectedPath ? { path: this.selectedPath } : {}),
      ...(this.lastError ? { error: this.lastError } : {}),
      candidates,
      ...(this.selectedPath ? { selectedPath: this.selectedPath } : {}),
    }
  }

  /** Start the engine if needed and return its live status. */
  async probe(): Promise<EngineStatus> {
    if (this.disposed) return this.status()
    try {
      await this.ensureStarted()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.state = 'error'
    }
    return this.status()
  }

  /** Select one of the discovered executables and restart the engine with it. */
  async select(file: string): Promise<EngineStatus> {
    const resolved = path.resolve(file)
    const allowed = this.candidates().some((candidate) => path.resolve(candidate.path).toLowerCase() === resolved.toLowerCase())
    if (!allowed) {
      throw new EngineError('engine-not-allowed', `Stockfish path is not in the discovered candidate list: ${file}`)
    }
    await this.stopProcess('switching engine')
    this.selectedPath = resolved
    this.saveSelectedPath(resolved)
    this.state = 'unavailable'
    this.lastError = ''
    return this.probe()
  }

  private resolveEnginePath(): string {
    const candidates = this.candidates()
    const preferred = this.config.enginePath?.trim()
    if (preferred) {
      const exact = candidates.find((candidate) => path.resolve(candidate.path).toLowerCase() === path.resolve(preferred).toLowerCase())
      if (exact) return exact.path
      throw new EngineError('engine-not-found', `Configured Stockfish path does not exist: ${preferred}`)
    }
    if (this.selectedPath) {
      const exact = candidates.find((candidate) => path.resolve(candidate.path).toLowerCase() === path.resolve(this.selectedPath!).toLowerCase())
      if (exact) return exact.path
    }
    if (candidates.length > 0) return candidates[0]!.path
    throw new EngineError(
      'engine-not-found',
      'No Stockfish executable found. Install Stockfish, or set enginePath in cordis.patch.yml; see the README.',
    )
  }

  private async ensureStarted(): Promise<void> {
    if (this.proc && this.state === 'ready') return
    if (this.starting) return this.starting
    this.starting = this.start().finally(() => {
      this.starting = null
    })
    return this.starting
  }

  private async start(): Promise<void> {
    const file = this.resolveEnginePath()
    this.selectedPath = file
    this.state = 'starting'
    this.lastError = ''
    this.stderr = ''
    this.output = ''
    const proc = spawn(file, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.proc = proc
    proc.stdout.setEncoding('utf8')
    proc.stderr.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => this.onStdout(chunk))
    proc.stderr.on('data', (chunk: string) => {
      this.stderr = `${this.stderr}${chunk}`.slice(-2000)
    })
    proc.on('error', (error) => this.failProcess(new EngineError('engine-start-failed', `Could not start Stockfish: ${error.message}`)))
    proc.on('exit', (code, signal) => {
      if (this.proc !== proc) return
      this.proc = null
      if (this.search) this.finishSearch(null, new EngineError('engine-exited', `Stockfish exited during analysis (code ${code ?? 'null'}, signal ${signal ?? 'none'}).`))
      if (!this.disposed) {
        this.state = 'error'
        this.lastError = `Stockfish exited (code ${code ?? 'null'}). ${this.stderr.trim()}`.trim()
      }
    })

    try {
      this.send('uci')
      // Wait only for `uciok`: `id name` arrives before it in the same burst,
      // and a second waiter registered after the first resolves would miss it.
      await this.waitFor((line) => line === 'uciok', START_TIMEOUT, 'UCI handshake')
      if (!this.version) {
        const match = /(\d+(?:\.\d+)+)/.exec(this.name)
        if (match) this.version = match[1]!
      }
      if (this.config.threads !== undefined) this.send(`setoption name Threads value ${clampInt(this.config.threads, 1, 16, 2)}`)
      if (this.config.hashMb !== undefined) this.send(`setoption name Hash value ${clampInt(this.config.hashMb, 16, 4096, 128)}`)
      this.send('isready')
      await this.waitFor((line) => line === 'readyok', START_TIMEOUT, 'readyok')
      this.state = 'ready'
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.state = 'error'
      await this.stopProcess('start failed')
      throw error instanceof EngineError ? error : new EngineError('engine-start-failed', this.lastError)
    }
  }

  private send(command: string): void {
    if (!this.proc || this.proc.stdin.destroyed) throw new EngineError('engine-not-running', 'Stockfish is not running.')
    this.proc.stdin.write(`${command}\n`)
  }

  private waitFor(test: (line: string) => boolean, timeoutMs: number, label: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((waiter) => waiter.timer !== timer)
        reject(new EngineError('engine-timeout', `Stockfish ${label} timed out.`))
      }, timeoutMs)
      this.waiters.push({ test, resolve, reject, timer })
    })
  }

  private onStdout(chunk: string): void {
    this.output += chunk
    for (;;) {
      const newline = this.output.indexOf('\n')
      if (newline < 0) break
      const line = this.output.slice(0, newline).trim()
      this.output = this.output.slice(newline + 1)
      if (line) this.onLine(line)
    }
  }

  private onLine(line: string): void {
    for (const waiter of [...this.waiters]) {
      if (!waiter.test(line)) continue
      clearTimeout(waiter.timer)
      this.waiters = this.waiters.filter((item) => item !== waiter)
      waiter.resolve(line)
    }
    if (line.startsWith('id name ')) this.name = line.slice(8).trim()
    if (line.startsWith('info ') && this.search) {
      const info = parseInfo(line)
      if (info) {
        this.search.lines.set(info.multipv, info)
        this.search.depth = Math.max(this.search.depth, info.depth)
      }
      const nodes = /\bnodes (\d+)/.exec(line)
      const nps = /\bnps (\d+)/.exec(line)
      if (nodes) this.search.nodes = Number(nodes[1])
      if (nps) this.search.nps = Number(nps[1])
    }
    if (line.startsWith('bestmove ') && this.search) {
      const bestmove = line.split(/\s+/)[1] ?? null
      this.finishSearch(bestmove, null)
    }
  }

  private finishSearch(bestmove: string | null, error: Error | null): void {
    const search = this.search
    if (!search || search.done) return
    search.done = true
    clearTimeout(search.timer)
    this.search = null
    search.markDone()
    if (search.cancelled) {
      search.reject(new EngineError('analysis-superseded', 'A newer analysis request replaced this one.'))
      return
    }
    if (error) {
      search.reject(error)
      return
    }
    const raw = [...search.lines.values()].sort((a, b) => a.multipv - b.multipv)
    const lines: EngineLine[] = raw.map((item) => {
      const normalized = normalizePv(search.fen, item.pv)
      const scored = scoreLine(item, search.turn)
      return { ...scored, pvUci: normalized, pvSan: uciToSan(search.fen, normalized) }
    })
    search.resolve({
      fen: search.fen,
      turn: search.turn,
      bestmove,
      depth: search.depth,
      nodes: search.nodes,
      nps: search.nps,
      timeMs: Math.max(0, Date.now() - search.startedAt),
      lines,
    })
  }

  private failProcess(error: Error): void {
    if (this.search) this.finishSearch(null, error)
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer)
      waiter.reject(error)
    }
    this.waiters = []
    this.state = 'error'
    this.lastError = error.message
    this.proc = null
  }

  private async stopProcess(reason: string): Promise<void> {
    const proc = this.proc
    this.proc = null
    if (!proc) return
    try {
      proc.stdin.write('quit\n')
    } catch {
      // Already gone.
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        try {
          proc.kill()
        } catch {
          // Already dead.
        }
        resolve()
      }, 600)
      proc.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
    this.state = this.disposed ? 'unavailable' : 'unavailable'
    this.lastError = this.disposed ? '' : reason
  }

  private async cancelActive(): Promise<void> {
    const search = this.search
    if (!search) return
    search.cancelled = true
    try {
      this.send('stop')
    } catch {
      // The process is gone; the analysis promise is already rejected.
    }
    await Promise.race([
      search.donePromise,
      new Promise<void>((resolve) => setTimeout(resolve, CANCEL_TIMEOUT)),
    ])
    if (!search.done) {
      this.finishSearch(null, new EngineError('analysis-superseded', 'A newer analysis request replaced this one.'))
      await this.stopProcess('analysis cancelled')
    }
  }

  /**
   * Analyse one FEN. A newer call supersedes an in-flight search.
   * @param request - validated request.
   * @returns best line set with White-POV scores.
   */
  async analyze(request: AnalyzeRequest): Promise<SearchResult> {
    if (this.disposed) throw new EngineError('engine-disposed', 'The chess coach host has been disposed.')
    const fen = request.fen.trim()
    if (!fen) throw new EngineError('bad-fen', 'fen is required')
    const game = new Chess(fen)
    if (game.isGameOver()) throw new EngineError('game-over', 'This position is already over; there is nothing to analyse.')
    // A newer request supersedes the in-flight search immediately, even if the
    // serialized start below has not reached its own cancel point yet.
    const running = this.search
    if (running && !running.done) {
      running.cancelled = true
      try {
        this.send('stop')
      } catch {
        // Process already gone; the waiter below will settle.
      }
    }
    const previous = this.analysisLock
    let release!: () => void
    this.analysisLock = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      await this.cancelActive()
      await this.ensureStarted()
      const depth = clampInt(request.depth, MIN_DEPTH, MAX_DEPTH, 14)
      const multipv = clampInt(request.multipv, 1, MAX_LINES, 3)
      const movetimeMs = request.movetimeMs === undefined ? undefined : clampInt(request.movetimeMs, 100, MAX_MOVETIME, 3000)
      const turn = game.turn()
      let markDone!: () => void
      const donePromise = new Promise<void>((resolve) => {
        markDone = resolve
      })
      const startedAt = Date.now()
      const timeoutMs = movetimeMs === undefined ? Math.min(30_000, 4_000 + depth * 1_300) : movetimeMs + 4_000
      const state: SearchState = {
        fen,
        turn,
        startedAt,
        lines: new Map(),
        depth: 0,
        nodes: 0,
        nps: 0,
        bestmove: null,
        done: false,
        cancelled: false,
        resolve: () => {},
        reject: () => {},
        timer: setTimeout(() => {}, 0),
        donePromise,
        markDone,
      }
      const promise = new Promise<SearchResult>((resolve, reject) => {
        state.resolve = resolve
        state.reject = reject
      })
      state.timer = setTimeout(() => {
        if (this.search === state) {
          this.finishSearch(null, new EngineError('engine-timeout', `Stockfish analysis timed out after ${timeoutMs} ms.`))
          try {
            this.send('stop')
          } catch {
            // Process already gone.
          }
        }
      }, timeoutMs)
      this.search = state
      try {
        this.send(`setoption name MultiPV value ${multipv}`)
        this.send('position fen ' + fen)
        this.send(movetimeMs === undefined ? `go depth ${depth}` : `go movetime ${movetimeMs}`)
      } catch (error) {
        this.finishSearch(null, error instanceof Error ? error : new Error(String(error)))
      }
      return await promise
    } finally {
      release()
    }
  }

  /** Stop the child process and release pending waiters. */
  async dispose(): Promise<void> {
    this.disposed = true
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer)
      waiter.reject(new EngineError('engine-disposed', 'The chess coach host has been disposed.'))
    }
    this.waiters = []
    if (this.search) this.finishSearch(null, new EngineError('engine-disposed', 'The chess coach host has been disposed.'))
    await this.stopProcess('disposed')
  }
}

export { EngineError }
