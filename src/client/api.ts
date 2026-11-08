import type {
  AnalyzeResponse,
  ApiFailure,
  CloudEvalResponse,
  EngineStatus,
  EnCroissantGameResponse,
  EnCroissantGamesResponse,
  EnCroissantStatus,
  OpeningResponse,
} from '../shared/types.ts'

const API = '/chess-coach/api'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Fall through to a status-derived message.
  }
  if (!response.ok) {
    const failure = body as ApiFailure | null
    throw new ApiError(
      response.status,
      failure?.error?.code ?? `http-${response.status}`,
      failure?.error?.message ?? `请求失败（HTTP ${response.status}）`,
    )
  }
  return body as T
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    method: 'GET',
    signal,
    headers: { accept: 'application/json' },
  })
  return readResponse<T>(response)
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    method: 'POST',
    signal,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return readResponse<T>(response)
}

export async function fetchEngineStatus(signal?: AbortSignal): Promise<EngineStatus> {
  const payload = await getJson<{ ok: true; status: EngineStatus }>('status', signal)
  return payload.status
}

export async function selectEngine(path: string): Promise<EngineStatus> {
  const payload = await postJson<{ ok: true; status: EngineStatus }>('engine/select', { path })
  return payload.status
}

export async function requestAnalysis(
  input: { fen: string; depth: number; multipv: number },
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  return postJson<AnalyzeResponse>('analyze', input, signal)
}

export async function requestCloudEval(fen: string, signal?: AbortSignal): Promise<CloudEvalResponse> {
  return getJson<CloudEvalResponse>(`cloud?fen=${encodeURIComponent(fen)}`, signal)
}

export async function requestOpening(fen: string, signal?: AbortSignal): Promise<OpeningResponse> {
  return getJson<OpeningResponse>(`opening?fen=${encodeURIComponent(fen)}`, signal)
}

export async function fetchEnCroissantStatus(signal?: AbortSignal): Promise<EnCroissantStatus> {
  const payload = await getJson<{ ok: true; status: EnCroissantStatus }>('en-croissant/status', signal)
  return payload.status
}

export async function fetchEnCroissantGames(
  input: {
    db: string
    player?: string
    event?: string
    result?: string
    after?: string
    before?: string
    limit?: number
    offset?: number
  },
  signal?: AbortSignal,
): Promise<EnCroissantGamesResponse> {
  const params = new URLSearchParams({ db: input.db })
  for (const key of ['player', 'event', 'result', 'after', 'before'] as const) {
    const value = input[key]
    if (value) params.set(key, value)
  }
  if (input.limit !== undefined) params.set('limit', String(input.limit))
  if (input.offset !== undefined) params.set('offset', String(input.offset))
  return getJson<EnCroissantGamesResponse>(`en-croissant/games?${params.toString()}`, signal)
}

export async function fetchEnCroissantGame(db: string, id: number, signal?: AbortSignal): Promise<EnCroissantGameResponse> {
  return getJson<EnCroissantGameResponse>(`en-croissant/game?db=${encodeURIComponent(db)}&id=${id}`, signal)
}

export async function openEnCroissant(): Promise<void> {
  await postJson<{ ok: true }>('en-croissant/open', {})
}
