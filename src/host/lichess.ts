/**
 * Optional Lichess cloud evaluation and opening explorer client.
 *
 * Neither endpoint needs an API token. Both are proxied through the host so
 * the browser avoids CORS, and both are cached and throttled: dragging a piece
 * around a board produces a burst of FENs, and Lichess asks clients to be
 * polite. A failure here never blocks the local Stockfish path.
 */
import { Chess } from 'chess.js'
import type {
  CloudEvalLine,
  CloudEvalResponse,
  OpeningMove,
  OpeningResponse,
} from '../shared/types.ts'
import { normalizePv, uciToSan } from './coach.ts'

const CACHE_TTL_MS = 5 * 60_000
const CACHE_MAX = 300
const MIN_INTERVAL_MS = 350
const FETCH_TIMEOUT_MS = 5_000

export class LichessError extends Error {
  readonly status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = 'LichessError'
    this.status = status
  }
}

interface CacheEntry<T> {
  readonly at: number
  readonly value: T
}

function normalizeFen(fen: string): string {
  const fields = fen.trim().split(/\s+/)
  return fields.slice(0, 4).join(' ')
}

function isUciToken(token: string): boolean {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token)
}

function turnOf(fen: string): 'w' | 'b' {
  return fen.split(/\s+/)[1] === 'b' ? 'b' : 'w'
}

/**
 * Lichess returns cloud-eval scores from White's point of view. Exposed for
 * tests so a future API change is caught in one place.
 */
export function cloudScoreToWhite(cp: number | undefined, fen: string): number | undefined {
  if (cp === undefined) return undefined
  void turnOf(fen)
  return cp
}

export function cloudMateToWhite(mate: number | undefined, fen: string): number | undefined {
  if (mate === undefined) return undefined
  void turnOf(fen)
  return mate
}

export class LichessClient {
  private readonly cache = new Map<string, CacheEntry<unknown>>()
  private nextRequestAt = 0

  private getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.at > CACHE_TTL_MS) {
      this.cache.delete(key)
      return undefined
    }
    return entry.value as T
  }

  private setCached<T>(key: string, value: T): void {
    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
    this.cache.set(key, { at: Date.now(), value })
  }

  private async throttle(): Promise<void> {
    const now = Date.now()
    const wait = Math.max(0, this.nextRequestAt - now)
    this.nextRequestAt = Math.max(now, this.nextRequestAt) + MIN_INTERVAL_MS
    if (wait > 0) await new Promise<void>((resolve) => setTimeout(resolve, wait))
  }

  private async requestJson(url: string): Promise<unknown> {
    await this.throttle()
    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'dsh-chess-coach/0.1.0',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    } catch (error) {
      throw new LichessError(`Lichess 请求失败：${error instanceof Error ? error.message : String(error)}`)
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new LichessError(`Lichess 返回 HTTP ${response.status}`, response.status === 429 ? 429 : 502)
    }
    try {
      return await response.json()
    } catch {
      throw new LichessError('Lichess 返回了无法解析的 JSON')
    }
  }

  /**
   * Fetch Lichess's cloud evaluation for a FEN.
   * @param fen - position to look up.
   * @returns the cloud lines, or null when Lichess has no cached evaluation.
   */
  async cloudEval(fen: string): Promise<CloudEvalResponse | null> {
    const key = normalizeFen(fen)
    const cached = this.getCached<CloudEvalResponse | null>(`cloud:${key}`)
    if (cached !== undefined) return cached
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(key)}&multiPv=3`
    const payload = await this.requestJson(url) as {
      fen?: string
      depth?: number
      knodes?: number
      pvs?: { moves?: string; cp?: number; mate?: number; depth?: number }[]
    } | null
    if (!payload || !Array.isArray(payload.pvs)) {
      this.setCached(`cloud:${key}`, null)
      return null
    }
    const lines: CloudEvalLine[] = []
    for (const pv of payload.pvs.slice(0, 3)) {
      const moves = (pv.moves ?? '').trim().split(/\s+/).filter(Boolean)
      if (moves.length === 0) continue
      const allUci = moves.every(isUciToken)
      const pvUci = allUci ? normalizePv(key, moves) : []
      const pvSan = allUci ? uciToSan(key, pvUci) : moves
      const whiteCp = cloudScoreToWhite(pv.cp, key)
      const whiteMate = cloudMateToWhite(pv.mate, key)
      lines.push({
        ...(pv.cp === undefined ? {} : { cp: pv.cp }),
        ...(pv.mate === undefined ? {} : { mate: pv.mate }),
        ...(whiteCp === undefined ? {} : { whiteCp }),
        ...(whiteMate === undefined ? {} : { whiteMate }),
        ...(pv.depth === undefined ? {} : { depth: pv.depth }),
        pvUci,
        pvSan,
      })
    }
    const value: CloudEvalResponse = {
      ok: true,
      source: 'lichess-cloud',
      fen: key,
      ...(payload.depth === undefined ? {} : { depth: payload.depth }),
      ...(payload.knodes === undefined ? {} : { knodes: payload.knodes }),
      lines,
    }
    this.setCached(`cloud:${key}`, value)
    return value
  }

  /**
   * Fetch the masters opening explorer for a FEN.
   * @param fen - position to look up.
   * @returns explorer stats, or null when no games reach the position.
   */
  async opening(fen: string): Promise<OpeningResponse | null> {
    const key = normalizeFen(fen)
    const cacheKey = `opening:${key}`
    const cached = this.getCached<OpeningResponse | null>(cacheKey)
    if (cached !== undefined) return cached
    const url = `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(key)}&topGames=0&moves=8`
    const payload = await this.requestJson(url) as {
      white?: number
      draws?: number
      black?: number
      moves?: {
        uci?: string
        san?: string
        white?: number
        draws?: number
        black?: number
        averageRating?: number
      }[]
      opening?: { eco?: string; name?: string }
    } | null
    if (!payload) {
      this.setCached(cacheKey, null)
      return null
    }
    const moves: OpeningMove[] = []
    for (const move of payload.moves ?? []) {
      if (!move.san || !move.uci) continue
      const white = Number(move.white ?? 0)
      const draws = Number(move.draws ?? 0)
      const black = Number(move.black ?? 0)
      moves.push({
        san: move.san,
        uci: move.uci,
        white,
        draws,
        black,
        games: white + draws + black,
        ...(move.averageRating === undefined ? {} : { averageRating: move.averageRating }),
      })
    }
    const value: OpeningResponse = {
      ok: true,
      source: 'lichess-explorer',
      fen: key,
      ...(payload.opening?.name ? { opening: { ...(payload.opening.eco ? { eco: payload.opening.eco } : {}), name: payload.opening.name } } : {}),
      games: Number(payload.white ?? 0) + Number(payload.draws ?? 0) + Number(payload.black ?? 0),
      moves: moves.slice(0, 8),
    }
    this.setCached(cacheKey, value)
    return value
  }
}

/** Small helper used by the route to validate a FEN before any network call. */
export function isValidFen(fen: string): boolean {
  try {
    new Chess(fen)
    return true
  } catch {
    return false
  }
}
