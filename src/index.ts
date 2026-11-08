/**
 * Host half of dsh-chess-coach.
 *
 * It owns the Stockfish child process and the optional Lichess proxy, and
 * exposes a tiny same-origin JSON API under `/chess-coach/api`. The browser
 * bundle only renders; it never sees a shell, a path, or a child process.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Chess } from 'chess.js'
import type { AnalyzeRequest, ApiFailure } from './shared/types.ts'
import { buildCoachReport } from './host/coach.ts'
import { EngineError, StockfishService } from './host/engine.ts'
import { EnCroissantError, EnCroissantService } from './host/encroissant.ts'
import { isValidFen, LichessClient, LichessError } from './host/lichess.ts'

export const name = 'dsh-chess-coach'
export const inject = ['webServer']

const API_PREFIX = '/chess-coach/api'
const MAX_BODY_BYTES = 64 * 1024

export interface ChessCoachConfig {
  /** Explicit Stockfish executable. Empty means auto-discovery. */
  readonly enginePath?: string
  /** UCI Threads option. */
  readonly threads?: number
  /** UCI Hash option, in MiB. */
  readonly hashMb?: number
  /** Default MultiPV when the request does not name one. */
  readonly defaultMultipv?: number
  /** Explicit En Croissant data directory; empty means auto-detect. */
  readonly enCroissantDataDir?: string
  /** Explicit En Croissant executable; empty means auto-detect. */
  readonly enCroissantAppPath?: string
}

interface WebServerLike {
  register(options: {
    readonly kind: 'prefix' | 'exact'
    readonly path: string
    readonly handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

export interface HostContext {
  readonly webServer: WebServerLike
  effect(callback: () => void | (() => void | Promise<void>), label?: string): void
}

class HttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded) return
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(text)
}

function writeFailure(res: ServerResponse, status: number, code: string, message: string): void {
  const body: ApiFailure = { ok: false, error: { code, message } }
  writeJson(res, status, body)
}

function fence(req: IncomingMessage): boolean {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  const host = req.headers.host
  if (!origin || !host) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'too-large', '请求体过大（上限 64 KiB）。')
    chunks.push(buffer)
  }
  if (size === 0) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'bad-json', '请求体不是合法 JSON。')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'bad-json', '请求体必须是 JSON 对象。')
  }
  return parsed as Record<string, unknown>
}

function requireFen(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, 'bad-fen', '缺少 fen。')
  }
  const fen = value.trim()
  if (fen.length > 120 || !isValidFen(fen)) {
    throw new HttpError(400, 'bad-fen', 'FEN 不合法。')
  }
  return fen
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

/**
 * Mount the plugin.
 * @param ctx - host context (web server + effect lifetime).
 * @param config - profile config from cordis.patch.yml.
 */
export function apply(ctx: HostContext, config: ChessCoachConfig = {}): void {
  const enCroissant = new EnCroissantService({
    ...(config.enCroissantDataDir ? { dataDir: config.enCroissantDataDir } : {}),
    ...(config.enCroissantAppPath ? { appPath: config.enCroissantAppPath } : {}),
  })
  const engine = new StockfishService({
    ...(config.enginePath ? { enginePath: config.enginePath } : {}),
    ...(config.threads === undefined ? {} : { threads: config.threads }),
    ...(config.hashMb === undefined ? {} : { hashMb: config.hashMb }),
    extraEngines: enCroissant.engines(),
  })
  const lichess = new LichessClient()

  ctx.effect(() => () => {
    void engine.dispose()
  }, 'dsh-chess-coach: stockfish process')

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: async (req, res) => {
      if (!fence(req)) {
        writeFailure(res, 403, 'forbidden', 'forbidden')
        return
      }
      const url = new URL(req.url ?? '/', 'http://dsh.internal')
      const method = req.method ?? 'GET'
      const action = url.pathname.startsWith(`${API_PREFIX}/`)
        ? url.pathname.slice(API_PREFIX.length + 1)
        : ''
      try {
        if (action === 'health' && method === 'GET') {
          writeJson(res, 200, { ok: true, name })
          return
        }
        if (action === 'status' && method === 'GET') {
          const status = await engine.probe()
          writeJson(res, 200, { ok: true, status })
          return
        }
        if (action === 'en-croissant/status' && method === 'GET') {
          writeJson(res, 200, { ok: true, status: await enCroissant.status() })
          return
        }
        if (action === 'en-croissant/games' && method === 'GET') {
          const database = url.searchParams.get('db')
          if (!database) throw new HttpError(400, 'bad-database', '缺少 db 参数。')
          const limit = Number(url.searchParams.get('limit') ?? '30')
          const offset = Number(url.searchParams.get('offset') ?? '0')
          const games = await enCroissant.games(database, {
            ...(url.searchParams.get('player') ? { player: url.searchParams.get('player')! } : {}),
            ...(url.searchParams.get('event') ? { event: url.searchParams.get('event')! } : {}),
            ...(url.searchParams.get('result') ? { result: url.searchParams.get('result')! } : {}),
            ...(url.searchParams.get('after') ? { after: url.searchParams.get('after')! } : {}),
            ...(url.searchParams.get('before') ? { before: url.searchParams.get('before')! } : {}),
            ...(Number.isFinite(limit) ? { limit } : {}),
            ...(Number.isFinite(offset) ? { offset } : {}),
          })
          writeJson(res, 200, games)
          return
        }
        if (action === 'en-croissant/game' && method === 'GET') {
          const database = url.searchParams.get('db')
          const id = Number(url.searchParams.get('id'))
          if (!database) throw new HttpError(400, 'bad-database', '缺少 db 参数。')
          if (!Number.isSafeInteger(id) || id < 0) throw new HttpError(400, 'bad-game', '对局 ID 不合法。')
          writeJson(res, 200, await enCroissant.game(database, id))
          return
        }
        if (action === 'en-croissant/open' && method === 'POST') {
          enCroissant.launch()
          writeJson(res, 200, { ok: true })
          return
        }
        if (action === 'engine/select' && method === 'POST') {
          const body = await readJson(req)
          if (typeof body.path !== 'string' || body.path.trim() === '') {
            throw new HttpError(400, 'bad-engine', '缺少 Stockfish 路径。')
          }
          const status = await engine.select(body.path)
          writeJson(res, 200, { ok: true, status })
          return
        }
        if (action === 'analyze' && method === 'POST') {
          const body = await readJson(req)
          const fen = requireFen(body.fen)
          const game = new Chess(fen)
          if (game.isGameOver()) throw new HttpError(422, 'game-over', '当前局面已经结束，无需继续分析。')
          const depth = numberOrUndefined(body.depth)
          const multipv = numberOrUndefined(body.multipv) ?? config.defaultMultipv
          const movetimeMs = numberOrUndefined(body.movetimeMs)
          const request: AnalyzeRequest = {
            fen,
            ...(depth === undefined ? {} : { depth }),
            ...(multipv === undefined ? {} : { multipv }),
            ...(movetimeMs === undefined ? {} : { movetimeMs }),
          }
          const result = await engine.analyze(request)
          const coach = buildCoachReport(fen, result.lines)
          const bestSan = result.bestmove && result.bestmove !== '(none)'
            ? result.lines.find((line) => line.multipv === 1)?.pvSan[0] ?? null
            : null
          writeJson(res, 200, {
            ok: true,
            fen,
            turn: result.turn,
            bestmove: result.bestmove,
            bestmoveSan: bestSan,
            depth: result.depth,
            nodes: result.nodes,
            nps: result.nps,
            timeMs: result.timeMs,
            lines: result.lines,
            coach,
            engine: { name: engine.status().name, ...(engine.status().version ? { version: engine.status().version } : {}) },
          })
          return
        }
        if (action === 'cloud' && method === 'GET') {
          const fen = requireFen(url.searchParams.get('fen'))
          const cloud = await lichess.cloudEval(fen)
          if (!cloud) {
            writeFailure(res, 404, 'cloud-miss', 'Lichess 云端没有这个局面的缓存评估。')
            return
          }
          writeJson(res, 200, cloud)
          return
        }
        if (action === 'opening' && method === 'GET') {
          const fen = requireFen(url.searchParams.get('fen'))
          const opening = await lichess.opening(fen)
          if (!opening) {
            writeFailure(res, 404, 'opening-miss', 'Lichess 开局库没有这个局面的对局记录。')
            return
          }
          writeJson(res, 200, opening)
          return
        }
        writeFailure(res, 404, 'not-found', `未知接口：${method} ${url.pathname}`)
      } catch (error) {
        if (error instanceof HttpError) {
          writeFailure(res, error.status, error.code, error.message)
          return
        }
        if (error instanceof EngineError) {
          const status = error.code === 'engine-not-found' || error.code === 'engine-start-failed' ? 503 : 409
          writeFailure(res, status, error.code, error.message)
          return
        }
        if (error instanceof EnCroissantError) {
          writeFailure(res, error.status, error.code, error.message)
          return
        }
        if (error instanceof LichessError) {
          writeFailure(res, error.status, 'lichess-error', error.message)
          return
        }
        const message = error instanceof Error ? error.message : String(error)
        writeFailure(res, 500, 'internal', message)
      }
    },
  }), 'dsh-chess-coach: /chess-coach/api routes')
}
