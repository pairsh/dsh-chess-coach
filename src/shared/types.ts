/** Wire types shared by the host routes and the browser half. */

export type Color = 'w' | 'b'

export interface EngineDescriptor {
  readonly path: string
  readonly label: string
  readonly version?: string
  readonly name?: string
  readonly source?: 'auto' | 'en-croissant'
  readonly kind?: 'stockfish' | 'lc0' | 'other'
  readonly options?: Readonly<Record<string, string | number | boolean>>
}

export interface EnCroissantDatabase {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly gameCount: number
  readonly playerCount: number
  readonly path: string
  readonly sizeBytes: number
  readonly pgnSidecar: boolean
  readonly readable: boolean
  readonly error?: string
}

export interface EnCroissantStatus {
  readonly installed: boolean
  readonly appPath?: string
  readonly dataDir: string
  readonly databases: readonly EnCroissantDatabase[]
  readonly engines: readonly EngineDescriptor[]
  readonly error?: string
}

export interface EnCroissantGame {
  readonly id: number
  readonly white: string
  readonly black: string
  readonly whiteElo?: number
  readonly blackElo?: number
  readonly result: string
  readonly date?: string
  readonly event?: string
  readonly site?: string
  readonly siteUrl?: string
  readonly timeControl?: string
  readonly eco?: string
  readonly plyCount?: number
  readonly pgnSidecar: boolean
}

export interface EnCroissantGamesResponse {
  readonly ok: true
  readonly database: string
  readonly games: readonly EnCroissantGame[]
  readonly returned: number
  readonly total?: number
}

export interface EnCroissantGameResponse {
  readonly ok: true
  readonly database: string
  readonly id: number
  readonly source: 'sidecar' | 'lichess'
  readonly pgn: string
  readonly headers: Readonly<Record<string, string>>
}

export interface EngineStatus {
  readonly available: boolean
  readonly state: 'ready' | 'starting' | 'unavailable' | 'error'
  readonly name: string
  readonly version?: string
  readonly path?: string
  readonly error?: string
  readonly candidates: readonly EngineDescriptor[]
  readonly selectedPath?: string
}

export interface AnalyzeRequest {
  readonly fen: string
  readonly depth?: number
  readonly multipv?: number
  readonly movetimeMs?: number
}

export interface EngineLine {
  /** MultiPV index, 1 is the engine's first choice. */
  readonly multipv: number
  readonly depth: number
  /** Score from the side to move's point of view. */
  readonly cp?: number
  readonly mate?: number
  /** Score converted to White's point of view. */
  readonly whiteCp?: number
  readonly whiteMate?: number
  readonly pvUci: readonly string[]
  readonly pvSan: readonly string[]
}

export interface CoachPlan {
  readonly color: Color
  readonly title: string
  readonly items: readonly string[]
}

export interface CoachMetric {
  readonly id: string
  readonly label: string
  readonly white: number
  readonly black: number
  readonly unit?: string
}

export interface CoachReport {
  readonly summary: string
  readonly phase: 'opening' | 'middlegame' | 'endgame'
  readonly phaseLabel: string
  readonly advantage: 'white' | 'black' | 'equal'
  readonly advantageText: string
  readonly recommendedMove: string
  readonly recommendation: string
  readonly tactics: readonly string[]
  readonly whitePlan: CoachPlan
  readonly blackPlan: CoachPlan
  readonly metrics: readonly CoachMetric[]
  readonly facts: readonly string[]
}

export interface AnalyzeResponse {
  readonly ok: true
  readonly fen: string
  readonly turn: Color
  readonly bestmove: string | null
  readonly bestmoveSan: string | null
  readonly depth: number
  readonly nodes: number
  readonly nps: number
  readonly timeMs: number
  readonly lines: readonly EngineLine[]
  readonly coach: CoachReport
  readonly engine: {
    readonly name: string
    readonly version?: string
  }
}

export interface ApiFailure {
  readonly ok: false
  readonly error: {
    readonly code: string
    readonly message: string
  }
}

export interface CloudEvalLine {
  readonly cp?: number
  readonly mate?: number
  readonly whiteCp?: number
  readonly whiteMate?: number
  readonly depth?: number
  readonly pvUci: readonly string[]
  readonly pvSan: readonly string[]
}

export interface CloudEvalResponse {
  readonly ok: true
  readonly source: 'lichess-cloud'
  readonly fen: string
  readonly depth?: number
  readonly knodes?: number
  readonly lines: readonly CloudEvalLine[]
}

export interface OpeningMove {
  readonly san: string
  readonly uci: string
  readonly white: number
  readonly draws: number
  readonly black: number
  readonly games: number
  readonly averageRating?: number
}

export interface OpeningResponse {
  readonly ok: true
  readonly source: 'lichess-explorer'
  readonly fen: string
  readonly opening?: { readonly eco?: string; readonly name?: string }
  readonly games: number
  readonly moves: readonly OpeningMove[]
}
