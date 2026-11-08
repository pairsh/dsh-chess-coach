import { formatEval, winPercent } from './chess-utils.ts'

export interface EvalBarProps {
  readonly whiteCp?: number
  readonly whiteMate?: number
  readonly source: string
}

export function EvalBar({ whiteCp, whiteMate, source }: EvalBarProps) {
  const percent = winPercent(whiteCp, whiteMate)
  const known = whiteCp !== undefined || whiteMate !== undefined
  return (
    <div className="cc-eval">
      <div className="cc-eval-track" role="img" aria-label={known ? `白方胜率约 ${Math.round(percent)}%` : '尚无评估'}>
        <div className="cc-eval-white" style={{ width: `${known ? percent : 50}%` }} />
        <div className="cc-eval-mid" />
      </div>
      <div className="cc-eval-readout">
        <span className={`cc-eval-value ${known && percent < 50 ? 'cc-eval-negative' : ''}`}>
          {known ? formatEval(whiteCp, whiteMate) : '—'}
        </span>
        <span className="cc-eval-source">{source}</span>
      </div>
    </div>
  )
}
