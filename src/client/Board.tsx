import type { DragEvent } from 'react'
import type { Color, PieceSymbol } from 'chess.js'
import { isLightSquare, PIECE_GLYPH, PIECE_NAME, squarePoint } from './chess-utils.ts'

export interface BoardCell {
  readonly square: string
  readonly type: PieceSymbol
  readonly color: Color
}

export interface BoardMoveTarget {
  readonly to: string
  readonly capture: boolean
}

export interface BoardArrow {
  readonly from: string
  readonly to: string
  readonly color: string
}

export interface BoardProps {
  readonly board: (BoardCell | null)[][]
  readonly orientation: Color
  readonly selected: string | null
  readonly legalTargets: readonly BoardMoveTarget[]
  readonly lastMove: { readonly from: string; readonly to: string } | null
  readonly checkSquare: string | null
  readonly arrow: BoardArrow | null
  readonly showArrows: boolean
  readonly turn: Color
  readonly onSquareClick: (square: string) => void
  readonly onDrop: (from: string, to: string) => void
}

function cellAt(board: (BoardCell | null)[][], square: string): BoardCell | null {
  for (const row of board) {
    for (const cell of row) {
      if (cell?.square === square) return cell
    }
  }
  return null
}

export function Board(props: BoardProps) {
  const { board, orientation, selected, legalTargets, lastMove, checkSquare, arrow, showArrows, turn, onSquareClick, onDrop } = props
  const targetMap = new Map(legalTargets.map((target) => [target.to, target.capture]))
  const rankRows = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const fileCols = orientation === 'w' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
  const from = arrow ? squarePoint(arrow.from, orientation) : null
  const to = arrow ? squarePoint(arrow.to, orientation) : null
  let line: { x1: number; y1: number; x2: number; y2: number } | null = null
  let head: string | null = null
  if (from && to) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy)
    if (length > 0.1) {
      const ux = dx / length
      const uy = dy / length
      const x1 = from.x + ux * 0.22
      const y1 = from.y + uy * 0.22
      const x2 = to.x - ux * 0.38
      const y2 = to.y - uy * 0.38
      const px = -uy * 0.16
      const py = ux * 0.16
      line = { x1, y1, x2, y2 }
      head = `${x2},${y2} ${x2 - ux * 0.28 + px},${y2 - uy * 0.28 + py} ${x2 - ux * 0.28 - px},${y2 - uy * 0.28 - py}`
    }
  }

  function dragStart(event: DragEvent<HTMLButtonElement>, square: string): void {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', square)
  }

  function drop(event: DragEvent<HTMLButtonElement>, square: string): void {
    event.preventDefault()
    const source = event.dataTransfer.getData('text/plain')
    if (source && source !== square) onDrop(source, square)
  }

  return (
    <div className={`cc-board cc-board-${orientation}`} role="grid" aria-label="国际象棋棋盘">
      {rankRows.map((rank, rowIndex) =>
        fileCols.map((file, colIndex) => {
          const square = `${file}${rank}`
          const piece = cellAt(board, square)
          const target = targetMap.get(square)
          const isSelected = selected === square
          const isLast = lastMove !== null && (lastMove.from === square || lastMove.to === square)
          const isCheck = checkSquare === square
          const classes = [
            'cc-square',
            isLightSquare(square) ? 'cc-light' : 'cc-dark',
            isSelected ? 'cc-selected' : '',
            isLast ? 'cc-last' : '',
            isCheck ? 'cc-check' : '',
            target !== undefined ? 'cc-target' : '',
            target === true ? 'cc-capture' : '',
            piece?.color === turn ? 'cc-movable' : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={square}
              type="button"
              role="gridcell"
              className={classes}
              aria-label={`${square}${piece ? ` ${piece.color === 'w' ? '白' : '黑'}${PIECE_NAME[piece.type]}` : ' 空格'}`}
              aria-selected={isSelected}
              draggable={piece !== null}
              onDragStart={(event) => dragStart(event, square)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, square)}
              onClick={() => onSquareClick(square)}
            >
              {colIndex === 0 && <span className="cc-coord cc-coord-rank">{rank}</span>}
              {rowIndex === 7 && <span className="cc-coord cc-coord-file">{file}</span>}
              {target !== undefined && <span className="cc-target-dot" aria-hidden="true" />}
              {piece && (
                <span className={`cc-piece cc-piece-${piece.color}`} aria-hidden="true">
                  {PIECE_GLYPH[piece.color][piece.type]}
                </span>
              )}
            </button>
          )
        }),
      )}
      {showArrows && line && head && (
        <svg className="cc-arrows" viewBox="0 0 8 8" preserveAspectRatio="none" aria-hidden="true">
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={arrow?.color ?? '#1f9d55'}
            strokeWidth="0.13"
            strokeLinecap="round"
            opacity="0.9"
          />
          <polygon points={head} fill={arrow?.color ?? '#1f9d55'} opacity="0.9" />
        </svg>
      )}
    </div>
  )
}
