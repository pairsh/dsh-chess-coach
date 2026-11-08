import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EnCroissantGame, EnCroissantStatus } from '../shared/types.ts'
import { fetchEnCroissantGames } from './api.ts'

export interface EnCroissantPanelProps {
  readonly status: EnCroissantStatus | null
  readonly statusLoading: boolean
  readonly onRefresh: () => void
  readonly onLoadGame: (database: string, id: number) => Promise<void>
  readonly onOpenApp: () => void
}

function formatDate(date: string | undefined): string {
  return date ? date.replaceAll('.', '-') : '—'
}

function resultLabel(result: string): string {
  if (result === '1-0') return '白胜'
  if (result === '0-1') return '黑胜'
  if (result === '1/2-1/2') return '和'
  return result
}

function gameSourceLabel(game: EnCroissantGame): string {
  if (game.pgnSidecar) return 'PGN'
  if (game.siteUrl && /lichess\.org/i.test(game.siteUrl)) return 'Lichess'
  return '仅元数据'
}

export function EnCroissantPanel(props: EnCroissantPanelProps) {
  const { status, statusLoading, onRefresh, onLoadGame, onOpenApp } = props
  const databases = status?.databases ?? []
  const readable = useMemo(() => databases.filter((db) => db.readable), [databases])
  const [database, setDatabase] = useState('')
  const [player, setPlayer] = useState('')
  const [event, setEvent] = useState('')
  const [result, setResult] = useState('')
  const [games, setGames] = useState<EnCroissantGame[]>([])
  const [total, setTotal] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gameError, setGameError] = useState<string | null>(null)
  const [loadingGame, setLoadingGame] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (readable.length === 0) {
      setDatabase('')
      return
    }
    if (!readable.some((db) => db.id === database)) setDatabase(readable[0]!.id)
  }, [database, readable])

  const search = useCallback(async (nextOffset = 0, append = false) => {
    if (!database) return
    setLoading(true)
    setError(null)
    setGameError(null)
    try {
      const response = await fetchEnCroissantGames({
        db: database,
        ...(player.trim() ? { player: player.trim() } : {}),
        ...(event.trim() ? { event: event.trim() } : {}),
        ...(result ? { result } : {}),
        limit: 30,
        offset: nextOffset,
      })
      setGames((current) => append ? [...current, ...response.games] : [...response.games])
      setTotal(response.total)
      setOffset(nextOffset + response.returned)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      if (!append) setGames([])
    } finally {
      setLoading(false)
    }
  }, [database, event, player, result])

  useEffect(() => {
    if (database) void search(0, false)
    // Search is intentionally triggered only when the selected database changes;
    // the form's button owns the other transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [database])

  const load = useCallback(async (game: EnCroissantGame) => {
    setLoadingGame(game.id)
    setGameError(null)
    try {
      await onLoadGame(database, game.id)
    } catch (cause) {
      setGameError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoadingGame(null)
    }
  }, [database, onLoadGame])

  if (statusLoading && !status) {
    return <div className="ec-panel"><div className="ec-empty">正在检测 En Croissant…</div></div>
  }

  if (!status?.installed) {
    return (
      <div className="ec-panel">
        <div className="ec-status-row">
          <span className="ec-status"><i className="ec-dot is-off" />En Croissant 未连接</span>
          <button type="button" className="cc-btn cc-btn-ghost" onClick={onRefresh} disabled={statusLoading}>重新检测</button>
        </div>
        <div className="ec-empty">
          <strong>没有找到 En Croissant 数据目录</strong>
          <p>默认位置：<code>%APPDATA%\org.encroissant.app</code></p>
          <p className="cc-muted">安装并启动一次 En Croissant 后，这里会显示本机的数据库和引擎。</p>
          {status?.appPath && <button type="button" className="cc-btn cc-btn-primary" onClick={onOpenApp}>打开 En Croissant</button>}
        </div>
      </div>
    )
  }

  const active = readable.find((db) => db.id === database)

  return (
    <div className="ec-panel">
      <div className="ec-status-row">
        <span className="ec-status"><i className="ec-dot is-on" />En Croissant 已连接</span>
        <div className="ec-status-actions">
          <button type="button" className="cc-btn cc-btn-ghost" onClick={onRefresh} disabled={statusLoading}>刷新</button>
          {status.appPath && <button type="button" className="cc-btn cc-btn-primary" onClick={onOpenApp}>打开应用</button>}
        </div>
      </div>
      {status.error && <div className="cc-inline-error">{status.error}</div>}

      {readable.length === 0 ? (
        <div className="ec-empty">
          <strong>没有可读数据库</strong>
          <p className="cc-muted">在 En Croissant 中导入一个 .db3 数据库后刷新。</p>
        </div>
      ) : (
        <>
          <label className="ec-field">
            <span>数据库</span>
            <select value={database} onChange={(change) => { setDatabase(change.target.value); setOffset(0) }}>
              {readable.map((db) => (
                <option key={db.id} value={db.id}>{db.title} · {db.gameCount.toLocaleString('zh-CN')} 局</option>
              ))}
            </select>
          </label>
          {active && (
            <div className="ec-db-meta">
              <span>{active.gameCount.toLocaleString('zh-CN')} 局</span>
              <span>{active.playerCount.toLocaleString('zh-CN')} 名棋手</span>
              <span>{active.pgnSidecar ? '有 PGN 附属文件' : '无 PGN 附属文件'}</span>
            </div>
          )}

          <div className="ec-filter-grid">
            <label className="ec-field"><span>棋手</span><input value={player} onChange={(change) => setPlayer(change.target.value)} placeholder="姓名包含…" onKeyDown={(event) => { if (event.key === 'Enter') void search(0, false) }} /></label>
            <label className="ec-field"><span>赛事</span><input value={event} onChange={(change) => setEvent(change.target.value)} placeholder="赛事包含…" onKeyDown={(event) => { if (event.key === 'Enter') void search(0, false) }} /></label>
            <label className="ec-field"><span>结果</span>
              <select value={result} onChange={(change) => setResult(change.target.value)}>
                <option value="">全部</option>
                <option value="1-0">白胜</option>
                <option value="0-1">黑胜</option>
                <option value="1/2-1/2">和棋</option>
              </select>
            </label>
          </div>
          <div className="ec-search-actions">
            <button type="button" className="cc-btn cc-btn-primary" onClick={() => void search(0, false)} disabled={loading}>{loading ? '查询中…' : '查询'}</button>
            <span className="cc-muted">{total !== undefined ? `约 ${total.toLocaleString('zh-CN')} 局` : `${games.length} 局`} · 只读</span>
          </div>

          {error && <div className="cc-inline-error">{error}</div>}
          {gameError && <div className="cc-inline-error">{gameError}</div>}

          <div className="ec-game-list">
            {games.length === 0 && !loading && <div className="ec-empty-small">没有匹配的对局。</div>}
            {games.map((game) => {
              const loadable = game.pgnSidecar || Boolean(game.siteUrl && /lichess/i.test(game.siteUrl))
              return (
              <button
                type="button"
                className={`ec-game-row ${loadable ? '' : 'is-metadata-only'}`}
                key={`${database}-${game.id}`}
                onClick={() => void load(game)}
                disabled={loadingGame === game.id || !loadable}
                title={game.pgnSidecar ? '从 PGN 附属文件载入' : game.siteUrl && /lichess/i.test(game.siteUrl) ? '从 Lichess 载入' : '仅元数据：En Croissant 的 Moves 是二进制索引，未解码'}
              >
                <span className="ec-game-date">{formatDate(game.date)}</span>
                <span className="ec-game-players">
                  <b>{game.white}</b>
                  {game.whiteElo !== undefined && <small>{game.whiteElo}</small>}
                  <i>vs</i>
                  <b>{game.black}</b>
                  {game.blackElo !== undefined && <small>{game.blackElo}</small>}
                </span>
                <span className={`ec-game-result ec-result-${game.result.replaceAll('/', '')}`}>{resultLabel(game.result)}</span>
                <span className={`ec-game-source ${game.pgnSidecar || game.siteUrl ? 'is-loadable' : ''}`}>{gameSourceLabel(game)}</span>
                {loadingGame === game.id && <span className="ec-row-spinner" />}
              </button>
              )
            })}
          </div>
          {games.length > 0 && (
            <button type="button" className="cc-btn cc-btn-ghost ec-load-more" onClick={() => void search(offset, true)} disabled={loading}>
              {loading ? '加载中…' : '加载更多'}
            </button>
          )}
          <p className="ec-note">
            En Croissant 的 <code>Moves</code> 列是 Rust 走子生成器的单字节索引，本项目不会猜测解码；可载入的对局来自 PGN 附属文件或 Lichess 链接。
          </p>
        </>
      )}
    </div>
  )
}
