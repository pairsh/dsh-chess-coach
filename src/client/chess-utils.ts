import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'

export const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

export const PIECE_GLYPH: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
}

export const PIECE_NAME: Record<PieceSymbol, string> = {
  p: '兵',
  n: '马',
  b: '象',
  r: '车',
  q: '后',
  k: '王',
}

export function replay(fen: string, moves: readonly string[]): Chess {
  const chess = new Chess(fen)
  for (const san of moves) chess.move(san)
  return chess
}

export function safeReplay(fen: string, moves: readonly string[]): Chess {
  try {
    return replay(fen, moves)
  } catch {
    return new Chess(DEFAULT_FEN)
  }
}

export function fileIndex(square: string): number {
  return FILES.indexOf(square[0] as (typeof FILES)[number])
}

export function rankOf(square: string): number {
  return Number(square[1])
}

export function isLightSquare(square: string): boolean {
  return (fileIndex(square) + rankOf(square)) % 2 === 1
}

export function squareName(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null
  return `${FILES[file]}${rank}` as Square
}

export function displaySquares(orientation: Color): Square[] {
  const files = orientation === 'w' ? FILES : [...FILES].reverse()
  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const squares: Square[] = []
  for (const rank of ranks) for (const file of files) squares.push(`${file}${rank}` as Square)
  return squares
}

export function squarePoint(square: string, orientation: Color): { x: number; y: number } {
  const file = fileIndex(square)
  const rank = rankOf(square)
  const col = orientation === 'w' ? file : 7 - file
  const row = orientation === 'w' ? 8 - rank : rank - 1
  return { x: col + 0.5, y: row + 0.5 }
}

export function formatEval(whiteCp?: number, whiteMate?: number): string {
  if (whiteMate !== undefined) {
    if (whiteMate > 0) return `M${whiteMate}`
    if (whiteMate < 0) return `-M${Math.abs(whiteMate)}`
    return 'M'
  }
  if (whiteCp === undefined) return '—'
  const value = whiteCp / 100
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

export function winPercent(whiteCp?: number, whiteMate?: number): number {
  if (whiteMate !== undefined) return whiteMate > 0 ? 100 : whiteMate < 0 ? 0 : 50
  if (whiteCp === undefined) return 50
  return Math.max(0, Math.min(100, 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * whiteCp)) - 1)))
}

export function evalToText(whiteCp?: number, whiteMate?: number): string {
  if (whiteMate !== undefined) {
    if (whiteMate > 0) return `白方 ${whiteMate} 步杀`
    if (whiteMate < 0) return `黑方 ${Math.abs(whiteMate)} 步杀`
    return '杀棋'
  }
  if (whiteCp === undefined) return '暂无评估'
  if (Math.abs(whiteCp) < 20) return '均势'
  return whiteCp > 0 ? `白方 +${(whiteCp / 100).toFixed(2)}` : `黑方 +${(Math.abs(whiteCp) / 100).toFixed(2)}`
}

export function movePairRows(moves: readonly string[]): { number: number; white?: string; black?: string }[] {
  const rows: { number: number; white?: string; black?: string }[] = []
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({
      number: Math.floor(index / 2) + 1,
      ...(moves[index] === undefined ? {} : { white: moves[index] }),
      ...(moves[index + 1] === undefined ? {} : { black: moves[index + 1] }),
    })
  }
  return rows
}

export function sanToMove(fen: string, san: string): { from: string; to: string; promotion?: string } | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move(san)
    return { from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) }
  } catch {
    return null
  }
}

export function pgnFromGame(fen: string, moves: readonly string[], myColor: Color): string {
  const chess = new Chess(fen)
  for (const san of moves) chess.move(san)
  chess.setHeader('Event', 'DSH Chess Coach study')
  chess.setHeader('Site', 'DeepSeek Harness')
  chess.setHeader('Date', new Date().toISOString().slice(0, 10).replaceAll('-', '.'))
  chess.setHeader('White', myColor === 'w' ? 'Me' : 'Opponent')
  chess.setHeader('Black', myColor === 'w' ? 'Opponent' : 'Me')
  const gameOver = chess.isGameOver()
  chess.setHeader('Result', gameOver ? (chess.isCheckmate() ? (chess.turn() === 'w' ? '0-1' : '1-0') : '1/2-1/2') : '*')
  if (fen !== DEFAULT_FEN) chess.setHeader('FEN', fen)
  return chess.pgn({ newline: '\n', maxWidth: 80 })
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function validateFen(input: string): string | null {
  const fen = input.trim()
  if (!fen) return null
  try {
    return new Chess(fen).fen()
  } catch {
    return null
  }
}
