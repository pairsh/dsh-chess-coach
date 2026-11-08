import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Color, EngineStatus, EnCroissantStatus } from '../shared/types.ts'
import type { Settings } from './types.ts'
import { validateFen } from './chess-utils.ts'
import { PIECE_CLASS } from './piece-theme.ts'

function ModalShell({ title, subtitle, onClose, children }: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const first = ref.current?.querySelector<HTMLElement>('button, input, textarea, select')
    first?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="cc-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="cc-modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="cc-modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="cc-icon-btn" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="cc-modal-body">{children}</div>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="cc-toggle-row">
      <span>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="cc-segmented">
      {options.map((option) => (
        <button key={option.value} type="button" className={option.value === value ? 'is-active' : ''} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsDialog({ settings, status, enCroissant, busy, onChange, onClose, onRefresh, onRefreshEnCroissant, onSelectEngine }: {
  settings: Settings
  status: EngineStatus | null
  enCroissant: EnCroissantStatus | null
  busy: boolean
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
  onRefresh: () => void
  onRefreshEnCroissant: () => void
  onSelectEngine: (path: string) => void
}) {
  const candidates = status?.candidates ?? []
  const current = status?.selectedPath ?? status?.path ?? candidates[0]?.path ?? ''
  const engineLabel = status?.available
    ? `${status.name}${status.version && !status.name.includes(status.version) ? ` ${status.version}` : ''}`
    : '本地引擎未就绪'
  return (
    <ModalShell title="棋局教练设置" subtitle="分析强度、引擎与云端数据源" onClose={onClose}>
      <div className="cc-settings-section">
        <h4>Stockfish</h4>
        <div className={`cc-engine-card ${status?.available ? 'is-ready' : 'is-offline'}`}>
          <div className="cc-engine-state">
            <span className="cc-engine-dot" />
            <div>
              <b>{engineLabel}</b>
              <small>{status?.error ?? status?.path ?? '自动检测中…'}</small>
            </div>
          </div>
          <button type="button" className="cc-btn cc-btn-ghost" onClick={onRefresh} disabled={busy}>
            {busy ? '检测中…' : '重新检测'}
          </button>
        </div>
        {candidates.length > 0 ? (
          <label className="cc-field">
            <span>引擎可执行文件</span>
            <select value={current} onChange={(event) => onSelectEngine(event.target.value)}>
              {candidates.map((candidate) => (
                <option key={candidate.path} value={candidate.path}>{candidate.label} · {candidate.path}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="cc-empty cc-empty-small">
            <p>没有找到 Stockfish。安装后重新检测，或在 <code>cordis.patch.yml</code> 的 <code>enginePath</code> 中填写绝对路径。</p>
            <p className="cc-muted">Windows 已自动搜索 En Croissant 的引擎目录、PATH 与常见安装位置。</p>
          </div>
        )}
      </div>

      <div className="cc-settings-section">
        <h4>En Croissant</h4>
        <div className={`cc-engine-card ${enCroissant?.installed ? 'is-ready' : 'is-offline'}`}>
          <div className="cc-engine-state">
            <span className="cc-engine-dot" />
            <div>
              <b>{enCroissant?.installed ? 'En Croissant 已连接' : 'En Croissant 未连接'}</b>
              <small>{enCroissant?.dataDir || '正在检测数据目录…'}</small>
            </div>
          </div>
          <button type="button" className="cc-btn cc-btn-ghost" onClick={onRefreshEnCroissant}>刷新</button>
        </div>
        {enCroissant?.installed ? (
          <p className="cc-muted cc-small">
            只读数据库 {enCroissant.databases.length} 个 · 引擎 {enCroissant.engines.length} 个。数据库页可搜索并载入带 PGN/Lichess 来源的对局。
          </p>
        ) : (
          <p className="cc-muted cc-small">
            在 En Croissant 中导入一次数据库后刷新；默认读取 <code>%APPDATA%\org.encroissant.app</code>。
          </p>
        )}
      </div>

      <div className="cc-settings-section">
        <h4>分析</h4>
        <label className="cc-field">
          <span>深度 <b>{settings.depth}</b>（越深越强，也越慢）</span>
          <input type="range" min={8} max={24} step={1} value={settings.depth} onChange={(event) => onChange({ depth: Number(event.target.value) })} />
        </label>
        <label className="cc-field">
          <span>候选着法 <b>{settings.multipv}</b> 条</span>
          <input type="range" min={1} max={5} step={1} value={settings.multipv} onChange={(event) => onChange({ multipv: Number(event.target.value) })} />
        </label>
        <Toggle checked={settings.autoAnalyze} onChange={(value) => onChange({ autoAnalyze: value })} label="实时分析" hint="每次走子或切换局面后自动分析" />
        <Toggle checked={settings.showArrows} onChange={(value) => onChange({ showArrows: value })} label="棋盘箭头" hint="显示当前选中引擎线的第一着" />
      </div>

      <div className="cc-settings-section">
        <h4>Cloud Lichess</h4>
        <Toggle checked={settings.cloudEval} onChange={(value) => onChange({ cloudEval: value })} label="云端评估" hint="与本地 Stockfish 交叉验证，无需 token" />
        <Toggle checked={settings.openingExplorer} onChange={(value) => onChange({ openingExplorer: value })} label="开局库" hint="Lichess 大师对局统计，可点击着法直接走棋" />
        <p className="cc-muted cc-small">Lichess 公共接口有速率限制；插件会在主机侧缓存并限流。</p>
      </div>

      <div className="cc-settings-section">
        <h4>教练视角</h4>
        <label className="cc-field">
          <span>我执</span>
          <Segmented<Color>
            value={settings.myColor}
            options={[{ value: 'w', label: '白方' }, { value: 'b', label: '黑方' }]}
            onChange={(value) => onChange({ myColor: value })}
          />
        </label>
        <p className="cc-muted cc-small">“你的计划 / 对手的计划”会按这个视角切换，白黑双方的局面分析始终都会保留。</p>
      </div>
    </ModalShell>
  )
}

export function FenDialog({ initial, onClose, onApply }: { initial: string; onClose: () => void; onApply: (fen: string) => void }) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  return (
    <ModalShell title="载入 FEN 局面" subtitle="支持完整六字段 FEN；载入后从该局面开始新棋局" onClose={onClose}>
      <label className="cc-field">
        <span>FEN</span>
        <textarea className="cc-textarea cc-fen-input" value={value} onChange={(event) => { setValue(event.target.value); setError(null) }} spellCheck={false} />
      </label>
      {error && <p className="cc-form-error">{error}</p>}
      <div className="cc-modal-actions">
        <button type="button" className="cc-btn cc-btn-ghost" onClick={onClose}>取消</button>
        <button type="button" className="cc-btn cc-btn-primary" onClick={() => {
          const fen = validateFen(value)
          if (!fen) { setError('FEN 不合法，请检查棋子布局、走子方与王的位置。'); return }
          onApply(fen)
        }}>载入局面</button>
      </div>
    </ModalShell>
  )
}

export function PgnDialog({ initial, onClose, onImport, onCopy }: {
  initial: string
  onClose: () => void
  onImport: (pgn: string) => void
  onCopy: (pgn: string) => void
}) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  return (
    <ModalShell title="PGN 导入 / 导出" subtitle="粘贴完整 PGN 载入棋局，或复制当前棋局" onClose={onClose}>
      <textarea className="cc-textarea cc-pgn-input" value={value} onChange={(event) => { setValue(event.target.value); setError(null) }} spellCheck={false} />
      {error && <p className="cc-form-error">{error}</p>}
      <div className="cc-modal-actions">
        <button type="button" className="cc-btn cc-btn-ghost" onClick={() => onCopy(value)}>复制</button>
        <button type="button" className="cc-btn cc-btn-ghost" onClick={onClose}>取消</button>
        <button type="button" className="cc-btn cc-btn-primary" onClick={() => {
          if (!value.trim()) { setError('PGN 为空。'); return }
          try {
            onImport(value)
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'PGN 解析失败。')
          }
        }}>载入 PGN</button>
      </div>
    </ModalShell>
  )
}

export function PromotionDialog({ color, onPick, onCancel }: { color: Color; onPick: (piece: 'q' | 'r' | 'b' | 'n') => void; onCancel: () => void }) {
  return (
    <div className="cc-promotion-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <div className="cc-promotion" role="dialog" aria-label="选择升变棋子">
        <div className="cc-promotion-title">升变为</div>
        {(['q', 'r', 'b', 'n'] as const).map((piece) => (
          <button key={piece} type="button" className="cc-promotion-choice" onClick={() => onPick(piece)}>
            <span className={`cc-piece ${color === 'w' ? 'white' : 'black'} ${PIECE_CLASS[piece]}`} aria-hidden="true" />
          </button>
        ))}
        <button type="button" className="cc-promotion-cancel" onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}
