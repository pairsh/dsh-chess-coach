import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Color, type Square } from 'chess.js'
import type {
  AnalyzeResponse,
  CloudEvalResponse,
  EngineStatus,
  OpeningResponse,
} from '../shared/types.ts'
import { ApiError, fetchEngineStatus, requestAnalysis, requestCloudEval, requestOpening, selectEngine } from './api.ts'
import { Board, type BoardArrow } from './Board.tsx'
import { CoachPanel } from './CoachPanel.tsx'
import { EvalBar } from './EvalBar.tsx'
import { FenDialog, PgnDialog, PromotionDialog, SettingsDialog } from './Dialogs.tsx'
import {
  DEFAULT_FEN,
  copyText,
  formatEval,
  movePairRows,
  pgnFromGame,
  safeReplay,
  sanToMove,
} from './chess-utils.ts'
import { KnightIcon } from './icons.tsx'
import type { Settings, StoredGame } from './types.ts'
import { DEFAULT_SETTINGS } from './types.ts'

const STORAGE_PREFIX = 'dsh-chess-coach:v1'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable in private windows; the board still works.
  }
}

function loadSettings(): Settings {
  const stored = readJson<Partial<Settings>>(`${STORAGE_PREFIX}:settings`)
  if (!stored) return { ...DEFAULT_SETTINGS }
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    depth: clampNumber(stored.depth, 8, 24, DEFAULT_SETTINGS.depth),
    multipv: clampNumber(stored.multipv, 1, 5, DEFAULT_SETTINGS.multipv),
    myColor: stored.myColor === 'b' ? 'b' : 'w',
    orientation: stored.orientation === 'b' ? 'b' : 'w',
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.round(number)))
}

function loadGame(sessionId: string): StoredGame {
  const stored = readJson<Partial<StoredGame>>(`${STORAGE_PREFIX}:game:${sessionId}`)
  if (!stored || typeof stored.startFen !== 'string' || !Array.isArray(stored.moves)) {
    return { startFen: DEFAULT_FEN, moves: [], cursor: 0 }
  }
  const moves = stored.moves.filter((move): move is string => typeof move === 'string')
  const cursor = clampNumber(stored.cursor, 0, moves.length, moves.length)
  try {
    const check = new Chess(stored.startFen)
    for (const move of moves.slice(0, cursor)) check.move(move)
    return { startFen: stored.startFen, moves, cursor }
  } catch {
    return { startFen: DEFAULT_FEN, moves: [], cursor: 0 }
  }
}

function resultText(chess: Chess): string | null {
  if (chess.isCheckmate()) return `将杀 · ${chess.turn() === 'w' ? '黑方' : '白方'}获胜`
  if (chess.isStalemate()) return '逼和 · 和棋'
  if (chess.isInsufficientMaterial()) return '子力不足 · 和棋'
  if (chess.isThreefoldRepetition()) return '三次重复 · 和棋'
  if (chess.isDrawByFiftyMoves()) return '五十回合 · 和棋'
  if (chess.isDraw()) return '和棋'
  return null
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError'
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return String(error)
}

export function ChessCoach({ sessionId }: { sessionId: string }) {
  const [initial] = useState(() => loadGame(sessionId))
  const [activeSession, setActiveSession] = useState(sessionId)
  const [startFen, setStartFen] = useState(initial.startFen)
  const [moves, setMoves] = useState<string[]>(initial.moves)
  const [cursor, setCursor] = useState(initial.cursor)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fenOpen, setFenOpen] = useState(false)
  const [pgnOpen, setPgnOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [promotion, setPromotion] = useState<{ from: string; to: string; color: Color } | null>(null)
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [cloud, setCloud] = useState<CloudEvalResponse | null>(null)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [opening, setOpening] = useState<OpeningResponse | null>(null)
  const [openingError, setOpeningError] = useState<string | null>(null)
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null)
  const [engineBusy, setEngineBusy] = useState(false)
  const [activeLine, setActiveLine] = useState(0)
  const [engineEpoch, setEngineEpoch] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    writeJson(`${STORAGE_PREFIX}:settings`, settings)
  }, [settings])

  // The native sidebar keep-mounts a page across Session switches, so the same
  // component instance can receive a new sessionId. Load that Session's study
  // before the persistence effect is allowed to write into it.
  useEffect(() => {
    if (sessionId === activeSession) return
    const next = loadGame(sessionId)
    setActiveSession(sessionId)
    setStartFen(next.startFen)
    setMoves(next.moves)
    setCursor(next.cursor)
    setSelected(null)
    setPromotion(null)
    setAnalysis(null)
    setAnalysisError(null)
    setCloud(null)
    setOpening(null)
    setActiveLine(0)
    setSettingsOpen(false)
    setFenOpen(false)
    setPgnOpen(false)
  }, [activeSession, sessionId])

  useEffect(() => {
    if (activeSession !== sessionId) return
    writeJson(`${STORAGE_PREFIX}:game:${activeSession}`, { startFen, moves, cursor } satisfies StoredGame)
  }, [activeSession, sessionId, startFen, moves, cursor])

  const game = useMemo(() => safeReplay(startFen, moves.slice(0, cursor)), [startFen, moves, cursor])
  const fen = game.fen()
  const turn = game.turn()
  const history = game.history({ verbose: true })
  const lastMove = history.at(-1) ?? null
  const board = game.board()
  const legalMoves = game.moves({ verbose: true })
  const gameOver = resultText(game)
  const check = game.isCheck()
  const checkSquare = useMemo(() => {
    if (!check) return null
    for (const row of board) {
      for (const cell of row) {
        if (cell && cell.type === 'k' && cell.color === turn) return cell.square
      }
    }
    return null
  }, [board, check, turn])
  const selectedTargets = selected
    ? legalMoves.filter((move) => move.from === selected).map((move) => ({ to: move.to, capture: Boolean(move.captured) }))
    : []
  const primaryLine = analysis?.lines[0]
  const cloudLine = cloud?.lines[0]
  // Keep the bar on one source at a time: mixing a local centipawn score with
  // a cloud mate score would show "M8" while the local line says +5.20.
  const evalWhiteCp = primaryLine ? primaryLine.whiteCp : cloudLine?.whiteCp
  const evalWhiteMate = primaryLine ? primaryLine.whiteMate : cloudLine?.whiteMate
  const evalSource = primaryLine
    ? `Stockfish d${analysis?.depth ?? primaryLine.depth}`
    : cloudLine
      ? `Lichess cloud d${cloud?.depth ?? cloudLine.depth ?? '—'}`
      : '未分析'
  const activePv = analysis?.lines[Math.min(activeLine, Math.max(0, analysis.lines.length - 1))]
  const firstUci = activePv?.pvUci[0]
  const arrow: BoardArrow | null = settings.showArrows && firstUci && firstUci.length >= 4
    ? { from: firstUci.slice(0, 2), to: firstUci.slice(2, 4), color: activeLine === 0 ? '#168f52' : '#4776d0' }
    : null
  const engineMessage = engineStatus === null
    ? '正在检测本地 Stockfish…'
    : engineStatus.available
      ? null
      : engineStatus.error ?? '未找到 Stockfish。'
  const moveRows = movePairRows(moves)

  const refreshEngine = useCallback(async () => {
    setEngineBusy(true)
    try {
      const status = await fetchEngineStatus()
      setEngineStatus(status)
      if (!status.available) notify(status.error ?? '未检测到 Stockfish')
    } catch (error) {
      if (!isAbort(error)) notify(`引擎检测失败：${errorText(error)}`)
    } finally {
      setEngineBusy(false)
    }
  }, [notify])

  useEffect(() => {
    void refreshEngine()
  }, [refreshEngine, engineEpoch])

  useEffect(() => {
    setAnalysis(null)
    setAnalysisError(null)
    if (!settings.autoAnalyze || gameOver) {
      setAnalysisLoading(false)
      return
    }
    const controller = new AbortController()
    let active = true
    const timer = setTimeout(() => {
      setAnalysisLoading(true)
      requestAnalysis({ fen, depth: settings.depth, multipv: settings.multipv }, controller.signal)
        .then((result) => {
          if (!active) return
          setAnalysis(result)
          setAnalysisError(null)
          setActiveLine(0)
        })
        .catch((error: unknown) => {
          if (!active || isAbort(error)) return
          if (error instanceof ApiError && error.code === 'analysis-superseded') return
          setAnalysis(null)
          setAnalysisError(errorText(error))
        })
        .finally(() => {
          if (active) setAnalysisLoading(false)
        })
    }, 320)
    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [fen, settings.autoAnalyze, settings.depth, settings.multipv, engineEpoch, engineStatus?.available, gameOver])

  useEffect(() => {
    setCloud(null)
    setOpening(null)
    setCloudError(null)
    setOpeningError(null)
    if (gameOver || (!settings.cloudEval && !settings.openingExplorer)) return
    const controller = new AbortController()
    let active = true
    const timer = setTimeout(() => {
      if (settings.cloudEval) {
        requestCloudEval(fen, controller.signal)
          .then((value) => { if (active) setCloud(value) })
          .catch((error: unknown) => {
            if (!active || isAbort(error)) return
            if (error instanceof ApiError && error.status === 404) return
            if (active) setCloudError(errorText(error))
          })
      }
      if (settings.openingExplorer) {
        requestOpening(fen, controller.signal)
          .then((value) => { if (active) setOpening(value) })
          .catch((error: unknown) => {
            if (!active || isAbort(error)) return
            if (error instanceof ApiError && error.status === 404) return
            if (active) setOpeningError(errorText(error))
          })
      }
    }, 480)
    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [fen, gameOver, settings.cloudEval, settings.openingExplorer])

  const changeSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])

  const commitMove = useCallback((from: string, to: string, promotionPiece?: string): boolean => {
    try {
      const next = new Chess(fen)
      const move = next.move({ from, to, ...(promotionPiece ? { promotion: promotionPiece } : {}) })
      if (!move) return false
      setMoves((current) => [...current.slice(0, cursor), move.san])
      setCursor(cursor + 1)
      setSelected(null)
      setActiveLine(0)
      setAnalysis(null)
      setAnalysisError(null)
      return true
    } catch {
      return false
    }
  }, [cursor, fen])

  const attemptMove = useCallback((from: string, to: string): boolean => {
    const candidates = legalMoves.filter((move) => move.from === from && move.to === to)
    if (candidates.length === 0) return false
    if (candidates.some((move) => move.promotion)) {
      setPromotion({ from, to, color: turn })
      return true
    }
    return commitMove(from, to)
  }, [commitMove, legalMoves, turn])

  const onSquareClick = useCallback((square: string) => {
    if (promotion) return
    const piece = game.get(square as Square)
    if (selected) {
      if (attemptMove(selected, square)) return
      if (piece && piece.color === turn) {
        setSelected(square)
        return
      }
      setSelected(null)
      return
    }
    if (piece && piece.color === turn) setSelected(square)
  }, [attemptMove, game, promotion, selected, turn])

  const onDrop = useCallback((from: string, to: string) => {
    if (promotion) return
    attemptMove(from, to)
  }, [attemptMove, promotion])

  const goTo = useCallback((ply: number) => {
    setCursor(Math.max(0, Math.min(moves.length, ply)))
    setSelected(null)
    setActiveLine(0)
  }, [moves.length])

  const undo = useCallback(() => {
    if (cursor === 0) return
    setMoves((current) => current.slice(0, cursor - 1))
    setCursor(cursor - 1)
    setSelected(null)
    setActiveLine(0)
  }, [cursor])

  const reset = useCallback(() => {
    setStartFen(DEFAULT_FEN)
    setMoves([])
    setCursor(0)
    setSelected(null)
    setAnalysis(null)
    setActiveLine(0)
    notify('已开始新棋局')
  }, [notify])

  const loadFen = useCallback((nextFen: string) => {
    setStartFen(nextFen)
    setMoves([])
    setCursor(0)
    setSelected(null)
    setFenOpen(false)
    notify('FEN 局面已载入')
  }, [notify])

  const importPgn = useCallback((text: string) => {
    const parsed = new Chess()
    parsed.loadPgn(text)
    const headers = parsed.getHeaders()
    const nextFen = typeof headers.FEN === 'string' && headers.FEN.trim() ? headers.FEN.trim() : DEFAULT_FEN
    const imported = parsed.history()
    const checkGame = new Chess(nextFen)
    for (const san of imported) checkGame.move(san)
    setStartFen(new Chess(nextFen).fen())
    setMoves(imported)
    setCursor(imported.length)
    setSelected(null)
    setPgnOpen(false)
    notify(`已载入 ${imported.length} 个半回合`)
  }, [notify])

  const exportPgn = useCallback((): string => pgnFromGame(startFen, moves.slice(0, cursor), settings.myColor), [cursor, moves, settings.myColor, startFen])

  const copyPgn = useCallback(async (text: string) => {
    if (await copyText(text)) notify('PGN 已复制')
    else notify('复制失败，请手动选择文本')
  }, [notify])

  const copyFen = useCallback(async () => {
    if (await copyText(fen)) notify('FEN 已复制')
    else notify('复制失败，请手动选择文本')
  }, [fen, notify])

  const playSan = useCallback((san: string) => {
    const found = sanToMove(fen, san)
    if (!found) {
      notify(`当前局面不能走 ${san}`)
      return
    }
    commitMove(found.from, found.to, found.promotion)
  }, [commitMove, fen, notify])

  const chooseEngine = useCallback(async (path: string) => {
    setEngineBusy(true)
    try {
      const status = await selectEngine(path)
      setEngineStatus(status)
      setEngineEpoch((value) => value + 1)
      notify(status.available ? 'Stockfish 已切换' : '引擎切换失败')
    } catch (error) {
      notify(`引擎切换失败：${errorText(error)}`)
    } finally {
      setEngineBusy(false)
    }
  }, [notify])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return
      if (settingsOpen || fenOpen || pgnOpen || promotion) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(cursor - 1) }
      else if (event.key === 'ArrowRight') { event.preventDefault(); goTo(cursor + 1) }
      else if (event.key === 'Home') { event.preventDefault(); goTo(0) }
      else if (event.key === 'End') { event.preventDefault(); goTo(moves.length) }
      else if (event.key.toLowerCase() === 'f') { event.preventDefault(); changeSettings({ orientation: settings.orientation === 'w' ? 'b' : 'w' }) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [changeSettings, cursor, fenOpen, goTo, moves.length, pgnOpen, promotion, settings.orientation, settingsOpen])

  const fullmove = Number.parseInt(fen.split(' ')[5] ?? '1', 10) || 1
  const sideText = turn === 'w' ? '白方走' : '黑方走'
  const scoreText = formatEval(evalWhiteCp, evalWhiteMate)
  const lastMoveSan = lastMove?.san ?? null

  return (
    <div className="cc-root">
      <header className="cc-header">
        <div className="cc-brand">
          <span className="cc-brand-icon"><KnightIcon size={18} /></span>
          <div>
            <div className="cc-brand-title">棋局教练</div>
            <div className="cc-brand-sub">Stockfish · Lichess</div>
          </div>
        </div>
        <div className="cc-header-actions">
          <button type="button" className="cc-icon-btn" title="翻转棋盘 (F)" aria-label="翻转棋盘" onClick={() => changeSettings({ orientation: settings.orientation === 'w' ? 'b' : 'w' })}>⇅</button>
          <button type="button" className="cc-icon-btn" title="设置" aria-label="设置" onClick={() => setSettingsOpen(true)}>⚙</button>
        </div>
      </header>

      <div className="cc-scroll">
        <section className="cc-board-section">
          <EvalBar whiteCp={evalWhiteCp} whiteMate={evalWhiteMate} source={evalSource} />
          {gameOver && <div className="cc-result-banner">{gameOver}</div>}
          <div className="cc-board-frame">
            <Board
              board={board}
              orientation={settings.orientation}
              selected={selected}
              legalTargets={selectedTargets}
              lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
              checkSquare={checkSquare}
              arrow={arrow}
              showArrows={settings.showArrows}
              turn={turn}
              onSquareClick={onSquareClick}
              onDrop={onDrop}
            />
          </div>
          <div className="cc-board-meta">
            <span className={`cc-turn ${turn === 'w' ? 'cc-turn-w' : 'cc-turn-b'}`}>{sideText}</span>
            <span>{check ? '将军！' : gameOver ?? `第 ${fullmove} 回合`}</span>
            {lastMoveSan && <span className="cc-muted">上一手 {lastMoveSan}</span>}
          </div>

          <div className="cc-controls">
            <button type="button" className="cc-btn cc-btn-icon" title="开局" aria-label="跳到开局" onClick={() => goTo(0)}>⏮</button>
            <button type="button" className="cc-btn cc-btn-icon" title="上一步" aria-label="上一步" onClick={() => goTo(cursor - 1)} disabled={cursor === 0}>◀</button>
            <button type="button" className="cc-btn cc-btn-icon" title="下一步" aria-label="下一步" onClick={() => goTo(cursor + 1)} disabled={cursor >= moves.length}>▶</button>
            <button type="button" className="cc-btn cc-btn-icon" title="最新" aria-label="跳到最新" onClick={() => goTo(moves.length)} disabled={cursor >= moves.length}>⏭</button>
            <span className="cc-controls-gap" />
            <button type="button" className="cc-btn cc-btn-icon" title="撤销" aria-label="撤销" onClick={undo} disabled={cursor === 0}>↩</button>
            <button type="button" className="cc-btn cc-btn-icon" title="新棋局" aria-label="新棋局" onClick={reset}>＋</button>
          </div>

          <div className="cc-library-actions">
            <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setFenOpen(true)}>FEN</button>
            <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setPgnOpen(true)}>PGN</button>
            <button type="button" className="cc-btn cc-btn-ghost" onClick={() => void copyFen()}>复制 FEN</button>
            <a className="cc-btn cc-btn-ghost cc-link-btn" href={`https://lichess.org/analysis/${encodeURIComponent(fen)}`} target="_blank" rel="noreferrer">Lichess ↗</a>
          </div>

          <div className="cc-move-list" aria-label="着法记录">
            {moveRows.length === 0 ? (
              <p className="cc-muted cc-move-empty">点击棋子或拖动走子；也可以载入 FEN / PGN。</p>
            ) : (
              moveRows.map((row, rowIndex) => (
                <div className="cc-move-row" key={row.number}>
                  <span className="cc-move-number">{row.number}.</span>
                  <button
                    type="button"
                    className={`cc-move ${cursor === rowIndex * 2 + 1 ? 'is-current' : ''}`}
                    onClick={() => goTo(rowIndex * 2 + 1)}
                  >{row.white ?? '…'}</button>
                  <button
                    type="button"
                    className={`cc-move ${cursor === rowIndex * 2 + 2 ? 'is-current' : ''}`}
                    onClick={() => goTo(rowIndex * 2 + 2)}
                    disabled={row.black === undefined}
                  >{row.black ?? ''}</button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="cc-analysis-section">
          <div className="cc-analysis-status">
            <span className={`cc-live-dot ${analysisLoading ? 'is-loading' : analysis ? 'is-live' : ''}`} />
            <span>{analysisLoading ? 'Stockfish 分析中…' : analysis ? `d${analysis.depth} · ${Math.round(analysis.nodes / 1000)}k 节点 · ${(analysis.timeMs / 1000).toFixed(1)}s` : '等待分析'}</span>
            <span className="cc-analysis-score">{scoreText}</span>
          </div>
          {analysisError && !analysisLoading && (
            <div className="cc-inline-error">{analysisError}</div>
          )}
          {analysis && analysis.lines.length > 0 && (
            <div className="cc-lines">
              {analysis.lines.slice(0, 5).map((line, index) => (
                <button
                  type="button"
                  key={`${line.multipv}-${index}`}
                  className={`cc-line ${activeLine === index ? 'is-active' : ''}`}
                  onClick={() => setActiveLine(index)}
                  title="点击在棋盘上显示这条线的第一着"
                >
                  <span className="cc-line-rank">{index + 1}</span>
                  <span className="cc-line-eval">{formatEval(line.whiteCp, line.whiteMate)}</span>
                  <span className="cc-line-san">{line.pvSan.slice(0, 7).join(' ')}</span>
                  <span className="cc-line-depth">d{line.depth}</span>
                </button>
              ))}
            </div>
          )}
          {!analysis && !analysisLoading && !analysisError && (
            <div className="cc-muted cc-analysis-hint">走一步棋，引擎会实时给出最佳着法与后续变化。</div>
          )}
        </section>

        <section className="cc-coach-section">
          <CoachPanel
            analysis={analysis}
            cloud={cloud}
            opening={opening}
            loading={analysisLoading}
            error={analysisError}
            engineMessage={engineMessage}
            gameOverText={gameOver}
            cloudEnabled={settings.cloudEval}
            openingEnabled={settings.openingExplorer}
            myColor={settings.myColor}
            onPlaySan={playSan}
          />
          {cloudError && <div className="cc-inline-error cc-inline-error-quiet">云端评估：{cloudError}</div>}
          {openingError && <div className="cc-inline-error cc-inline-error-quiet">开局库：{openingError}</div>}
        </section>

        <footer className="cc-footer">
          <span>教练分析由 Stockfish 评估驱动，不替代你的计算。</span>
          <button type="button" className="cc-text-btn" onClick={() => setSettingsOpen(true)}>分析设置</button>
        </footer>
      </div>

      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          status={engineStatus}
          busy={engineBusy}
          onChange={changeSettings}
          onClose={() => setSettingsOpen(false)}
          onRefresh={() => { setEngineStatus(null); setEngineEpoch((value) => value + 1) }}
          onSelectEngine={(path) => void chooseEngine(path)}
        />
      )}
      {fenOpen && <FenDialog initial={fen} onClose={() => setFenOpen(false)} onApply={loadFen} />}
      {pgnOpen && <PgnDialog initial={exportPgn()} onClose={() => setPgnOpen(false)} onImport={importPgn} onCopy={(text) => void copyPgn(text)} />}
      {promotion && (
        <PromotionDialog
          color={promotion.color}
          onCancel={() => setPromotion(null)}
          onPick={(piece) => {
            const pending = promotion
            setPromotion(null)
            if (pending) commitMove(pending.from, pending.to, piece)
          }}
        />
      )}
      {toast && <div className="cc-toast" role="status">{toast}</div>}
      <div className="cc-sr-only" aria-live="polite">{analysis?.coach.summary ?? ''}</div>
    </div>
  )
}
