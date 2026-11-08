import type { AnalyzeResponse, CloudEvalResponse, Color, OpeningResponse } from '../shared/types.ts'
import { formatEval } from './chess-utils.ts'

export interface CoachPanelProps {
  readonly analysis: AnalyzeResponse | null
  readonly cloud: CloudEvalResponse | null
  readonly opening: OpeningResponse | null
  readonly loading: boolean
  readonly error: string | null
  readonly engineMessage: string | null
  readonly gameOverText: string | null
  readonly cloudEnabled: boolean
  readonly openingEnabled: boolean
  readonly myColor: Color
  readonly onPlaySan: (san: string) => void
}

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

function MetricRow({ label, white, black, unit }: { label: string; white: number; black: number; unit?: string }) {
  const total = Math.max(0.001, white + black)
  const whitePct = Math.max(0, Math.min(100, (white / total) * 100))
  return (
    <div className="cc-metric">
      <div className="cc-metric-head">
        <span>{label}</span>
        <span className="cc-metric-values">
          <b>{Number.isInteger(white) ? white : white.toFixed(1)}{unit ?? ''}</b>
          <i>/</i>
          <b>{Number.isInteger(black) ? black : black.toFixed(1)}{unit ?? ''}</b>
        </span>
      </div>
      <div className="cc-metric-bar" aria-hidden="true">
        <span className="cc-metric-white" style={{ width: `${whitePct}%` }} />
        <span className="cc-metric-black" />
      </div>
    </div>
  )
}

function SectionTitle({ children, aside }: { children: string; aside?: string }) {
  return (
    <div className="cc-section-title">
      <span>{children}</span>
      {aside && <span className="cc-section-aside">{aside}</span>}
    </div>
  )
}

function OpeningCard({ opening, onPlaySan }: { opening: OpeningResponse; onPlaySan: (san: string) => void }) {
  const total = Math.max(1, opening.games)
  return (
    <div className="cc-opening">
      <div className="cc-opening-head">
        <div>
          <div className="cc-opening-name">{opening.opening?.name ?? '开局库'}</div>
          <div className="cc-muted">
            {opening.opening?.eco ? `${opening.opening.eco} · ` : ''}
            Lichess 大师库 · {compactNumber(opening.games)} 局
          </div>
        </div>
      </div>
      {opening.moves.length > 0 && (
        <div className="cc-opening-moves">
          {opening.moves.slice(0, 5).map((move) => {
            const whitePct = (move.white / Math.max(1, move.games)) * 100
            const drawPct = (move.draws / Math.max(1, move.games)) * 100
            const blackPct = (move.black / Math.max(1, move.games)) * 100
            return (
              <button key={move.uci} type="button" className="cc-opening-move" onClick={() => onPlaySan(move.san)} title={`走 ${move.san}`}>
                <span className="cc-opening-san">{move.san}</span>
                <span className="cc-opening-count">{compactNumber(move.games)}</span>
                <span className="cc-opening-bar" aria-hidden="true">
                  <i style={{ width: `${whitePct}%`, background: 'var(--cc-white-bar)' }} />
                  <i style={{ width: `${drawPct}%`, background: 'var(--cc-draw-bar)' }} />
                  <i style={{ width: `${blackPct}%`, background: 'var(--cc-black-bar)' }} />
                </span>
                <span className="cc-opening-pct">{Math.round((move.white / Math.max(1, move.games)) * 100)}%</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="cc-muted cc-opening-footer">{compactNumber(total)} 局样本，点击着法直接走棋。</div>
    </div>
  )
}

export function CoachPanel(props: CoachPanelProps) {
  const { analysis, cloud, opening, loading, error, engineMessage, gameOverText, cloudEnabled, openingEnabled, myColor, onPlaySan } = props
  const coach = analysis?.coach
  const myPlan = coach ? (myColor === 'w' ? coach.whitePlan : coach.blackPlan) : null
  const opponentPlan = coach ? (myColor === 'w' ? coach.blackPlan : coach.whitePlan) : null
  const cloudLine = cloud?.lines[0]
  const cloudText = cloudLine ? formatEval(cloudLine.whiteCp, cloudLine.whiteMate) : '—'

  if (!coach) {
    return (
      <div className="cc-coach">
        <SectionTitle>教练点评</SectionTitle>
        {gameOverText ? (
          <div className="cc-empty cc-empty-result">
            <strong>{gameOverText}</strong>
            <p className="cc-muted">可以回看前面的着法，或开始新棋局。</p>
          </div>
        ) : loading ? (
          <div className="cc-skeleton">
            <span /><span /><span />
            <p>Stockfish 正在计算，教练马上给出结论…</p>
          </div>
        ) : error || engineMessage ? (
          <div className="cc-empty cc-empty-warn">
            <strong>本地引擎暂不可用</strong>
            <p>{engineMessage ?? error}</p>
            <p className="cc-muted">棋盘和手动走子仍然可用。可在设置中选择 Stockfish，或开启 Lichess 云端评估。</p>
          </div>
        ) : (
          <div className="cc-empty">
            <strong>等待局面</strong>
            <p>走一步棋，或载入 FEN / PGN，教练会自动分析。</p>
          </div>
        )}
        {cloud && cloud.lines.length > 0 && (
          <div className="cc-cloud">
            <div className="cc-cloud-head">
              <span className="cc-cloud-title">Lichess 云端评估</span>
              <span className="cc-cloud-eval">{cloudText}</span>
            </div>
            <div className="cc-cloud-depth">深度 {cloud.depth ?? '—'} · {compactNumber(cloud.knodes ?? 0)} knodes</div>
            {cloud.lines[0] && <div className="cc-pv-line">{cloud.lines[0].pvSan.join(' ')}</div>}
          </div>
        )}
        {opening && <OpeningCard opening={opening} onPlaySan={onPlaySan} />}
      </div>
    )
  }

  return (
    <div className="cc-coach">
      <div className="cc-verdict">
        <div className="cc-verdict-top">
          <span className={`cc-verdict-pill cc-verdict-${coach.advantage}`}>{coach.advantageText}</span>
          <span className="cc-phase">{coach.phaseLabel}</span>
        </div>
        <p>{coach.summary}</p>
      </div>

      <div className="cc-next">
        <div className="cc-next-label">引擎首选</div>
        <div className="cc-next-move">{coach.recommendedMove}</div>
        <p>{coach.recommendation}</p>
      </div>

      <SectionTitle>战术警报</SectionTitle>
      <ul className="cc-tactics">
        {coach.tactics.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ul>

      {myPlan && (
        <div className="cc-plan cc-plan-mine">
          <div className="cc-plan-title">
            <span>你的计划</span>
            <span className={`cc-side-dot cc-side-dot-${myColor}`} />
          </div>
          <ul>
            {myPlan.items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
          </ul>
        </div>
      )}
      {opponentPlan && (
        <div className="cc-plan">
          <div className="cc-plan-title">
            <span>对手的计划</span>
            <span className={`cc-side-dot cc-side-dot-${myColor === 'w' ? 'b' : 'w'}`} />
          </div>
          <ul>
            {opponentPlan.items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
          </ul>
        </div>
      )}

      <SectionTitle>局面要素</SectionTitle>
      <div className="cc-metrics">
        {coach.metrics.map((metric) => (
          <MetricRow key={metric.id} label={metric.label} white={metric.white} black={metric.black} unit={metric.unit} />
        ))}
      </div>

      <div className="cc-facts">
        {coach.facts.map((fact, index) => <span key={`${index}-${fact}`}>{fact}</span>)}
      </div>

      {cloud && cloud.lines.length > 0 && (
        <div className="cc-cloud">
          <div className="cc-cloud-head">
            <span className="cc-cloud-title">Lichess 云端</span>
            <span className="cc-cloud-eval">{cloudText}</span>
          </div>
          <div className="cc-cloud-depth">深度 {cloud.depth ?? '—'} · 与本地引擎交叉验证</div>
          {cloud.lines.slice(0, 2).map((line, index) => (
            <div className="cc-cloud-line" key={index}>
              <span className="cc-cloud-line-eval">{formatEval(line.whiteCp, line.whiteMate)}</span>
              <span className="cc-pv-line">{line.pvSan.join(' ')}</span>
            </div>
          ))}
        </div>
      )}

      {opening && <OpeningCard opening={opening} onPlaySan={onPlaySan} />}
      {!opening && !cloud && !cloudEnabled && !openingEnabled && (
        <div className="cc-muted cc-cloud-hint">
          可在设置中开启 Lichess 云端评估与开局库；需要联网，不需要 API token。
        </div>
      )}
    </div>
  )
}
