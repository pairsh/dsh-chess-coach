/**
 * Deterministic, engine-grounded coaching commentary.
 *
 * The coach never invents an evaluation: every numeric claim comes from the
 * Stockfish (or Lichess cloud) lines passed in. What it adds is structure —
 * material, king safety, development, pawn weaknesses, hanging pieces and the
 * concrete continuation — so the panel reads like a coach rather than a UCI
 * dump. Keeping this layer deterministic means it also works offline and never
 * spends model tokens.
 */
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import type {
  CoachMetric,
  CoachPlan,
  CoachReport,
  EngineLine,
} from '../shared/types.ts'

const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3.25,
  r: 5,
  q: 9,
  k: 0,
}

const PIECE_NAME: Record<PieceSymbol, string> = {
  p: '兵',
  n: '马',
  b: '象',
  r: '车',
  q: '后',
  k: '王',
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

interface SideFacts {
  readonly king: Square
  readonly material: number
  readonly pawns: number
  readonly minorsDeveloped: number
  readonly castled: boolean
  readonly kingSafety: number
  readonly center: number
  readonly pawnScore: number
  readonly doubled: number
  readonly isolated: number
  readonly passed: readonly Square[]
  readonly openFiles: readonly string[]
  readonly hanging: readonly { square: Square; piece: PieceSymbol; value: number }[]
  readonly backRankWeak: boolean
  readonly kingFileOpen: boolean
}

interface Facts {
  readonly chess: Chess
  readonly turn: Color
  readonly phase: 'opening' | 'middlegame' | 'endgame'
  readonly phaseLabel: string
  readonly white: SideFacts
  readonly black: SideFacts
  readonly openFiles: readonly string[]
  readonly moveNumber: number
  readonly check: boolean
  readonly gameOver: string | null
}

interface ParsedScore {
  readonly whiteCp?: number
  readonly whiteMate?: number
}

function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

function colorName(color: Color): string {
  return color === 'w' ? '白方' : '黑方'
}

function fileOf(square: Square): string {
  return square[0]!
}

function rankOf(square: Square): number {
  return Number(square[1])
}

function fileIndex(square: Square): number {
  return FILES.indexOf(fileOf(square) as (typeof FILES)[number])
}

function homeRank(color: Color): number {
  return color === 'w' ? 1 : 8
}

function promotionRank(color: Color): number {
  return color === 'w' ? 8 : 1
}

function allPieces(chess: Chess): { square: Square; color: Color; type: PieceSymbol }[] {
  const out: { square: Square; color: Color; type: PieceSymbol }[] = []
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell) out.push({ square: cell.square, color: cell.color, type: cell.type })
    }
  }
  return out
}

function pawnFiles(chess: Chess, color: Color): Map<string, Square[]> {
  const map = new Map<string, Square[]>()
  for (const piece of allPieces(chess)) {
    if (piece.color !== color || piece.type !== 'p') continue
    const file = fileOf(piece.square)
    const list = map.get(file) ?? []
    list.push(piece.square)
    map.set(file, list)
  }
  return map
}

function isPassedPawn(square: Square, color: Color, enemyPawns: readonly Square[]): boolean {
  const file = fileIndex(square)
  const rank = rankOf(square)
  return !enemyPawns.some((enemy) => {
    const df = Math.abs(fileIndex(enemy) - file)
    if (df > 1) return false
    return color === 'w' ? rankOf(enemy) > rank : rankOf(enemy) < rank
  })
}

function countAttackers(chess: Chess, square: Square, color: Color): number {
  try {
    return chess.attackers(square, color).length
  } catch {
    return 0
  }
}

function hangingPieces(chess: Chess, color: Color): { square: Square; piece: PieceSymbol; value: number }[] {
  const out: { square: Square; piece: PieceSymbol; value: number }[] = []
  for (const piece of allPieces(chess)) {
    if (piece.color !== color || piece.type === 'k') continue
    if (countAttackers(chess, piece.square, opposite(color)) === 0) continue
    if (countAttackers(chess, piece.square, color) > 0) continue
    out.push({ square: piece.square, piece: piece.type, value: PIECE_VALUE[piece.type] })
  }
  return out.sort((a, b) => b.value - a.value)
}

function openFiles(chess: Chess): string[] {
  const white = pawnFiles(chess, 'w')
  const black = pawnFiles(chess, 'b')
  return FILES.filter((file) => !white.has(file) && !black.has(file))
}

function sideFacts(chess: Chess, color: Color, moveNumber: number): SideFacts {
  const own = allPieces(chess).filter((p) => p.color === color)
  const enemy = allPieces(chess).filter((p) => p.color !== color)
  const king = own.find((p) => p.type === 'k')?.square ?? (color === 'w' ? 'e1' : 'e8')
  const material = own.reduce((sum, p) => sum + PIECE_VALUE[p.type], 0)
  const enemyMaterial = enemy.reduce((sum, p) => sum + PIECE_VALUE[p.type], 0)
  const ownPawns = own.filter((p) => p.type === 'p')
  const enemyPawns = enemy.filter((p) => p.type === 'p')
  const ownPawnFiles = pawnFiles(chess, color)
  const enemyPawnSquares = enemyPawns.map((p) => p.square)
  const doubled = [...ownPawnFiles.values()].reduce((sum, list) => sum + Math.max(0, list.length - 1), 0)
  const isolated = [...ownPawnFiles.entries()].filter(([file]) => {
    const idx = FILES.indexOf(file as (typeof FILES)[number])
    const left = idx > 0 ? FILES[idx - 1]! : undefined
    const right = idx < 7 ? FILES[idx + 1]! : undefined
    return (!left || !ownPawnFiles.has(left)) && (!right || !ownPawnFiles.has(right))
  }).reduce((sum, [, list]) => sum + list.length, 0)
  const passed = ownPawns
    .map((p) => p.square)
    .filter((square) => isPassedPawn(square, color, enemyPawnSquares))

  const home = homeRank(color)
  const castled =
    (color === 'w' && (king === 'g1' || king === 'c1')) ||
    (color === 'b' && (king === 'g8' || king === 'c8'))
  const minorHomes: Square[] =
    color === 'w' ? ['b1', 'g1', 'c1', 'f1'] : ['b8', 'g8', 'c8', 'f8']
  const minorsDeveloped = minorHomes.filter((sq) => {
    const piece = chess.get(sq)
    return !(piece && piece.color === color && (piece.type === 'n' || piece.type === 'b'))
  }).length

  const kingFileIdx = fileIndex(king)
  const shieldFiles = [kingFileIdx - 1, kingFileIdx, kingFileIdx + 1]
    .filter((idx) => idx >= 0 && idx < 8)
    .map((idx) => FILES[idx]!)
  const direction = color === 'w' ? 1 : -1
  let shield = 0
  for (const file of shieldFiles) {
    const rank = rankOf(king) + direction
    if (rank >= 1 && rank <= 8) {
      const sq = `${file}${rank}` as Square
      const piece = chess.get(sq)
      if (piece && piece.color === color && piece.type === 'p') shield++
    }
  }
  const kingFileOpen = shieldFiles.some((file) => !ownPawnFiles.has(file))
  const nearKingAttackers = allPieces(chess)
    .filter((p) => p.color !== color && p.type !== 'p' && Math.abs(fileIndex(p.square) - kingFileIdx) <= 1 && Math.abs(rankOf(p.square) - rankOf(king)) <= 2)
    .length
  let kingSafety = 82
  kingSafety -= (3 - shield) * 11
  if (kingFileOpen) kingSafety -= 10
  if (castled) kingSafety += 10
  else if (moveNumber > 10) kingSafety -= 12
  kingSafety -= nearKingAttackers * 5
  kingSafety = Math.max(5, Math.min(100, Math.round(kingSafety)))

  const centerSquares: Square[] = ['d4', 'e4', 'd5', 'e5']
  let centerRaw = 0
  for (const square of centerSquares) {
    const occupant = chess.get(square)
    if (occupant && occupant.color === color) centerRaw += occupant.type === 'p' ? 3 : 2
    centerRaw += Math.min(2, countAttackers(chess, square, color))
  }
  const center = Math.max(0, Math.min(100, Math.round(centerRaw * 6)))

  let pawnScore = 90
  pawnScore -= doubled * 10
  pawnScore -= isolated * 8
  pawnScore += passed.length * 5
  if (ownPawnFiles.size >= 4) pawnScore += 4
  pawnScore = Math.max(10, Math.min(100, pawnScore))

  const open = openFiles(chess)
  const ownOpen = open.filter((file) => {
    const idx = FILES.indexOf(file as (typeof FILES)[number])
    return Math.abs(idx - kingFileIdx) <= 1
  })
  const backRankWeak =
    rankOf(king) === home &&
    !ownPawnFiles.has(FILES[kingFileIdx]!) &&
    ownOpen.length > 0
  const ownOpenFiles = FILES.filter((file) => !ownPawnFiles.has(file))

  return {
    king,
    material: Math.round(material * 100) / 100,
    pawns: ownPawns.length,
    minorsDeveloped,
    castled,
    kingSafety,
    center,
    pawnScore,
    doubled,
    isolated,
    passed,
    openFiles: ownOpenFiles,
    hanging: hangingPieces(chess, color),
    backRankWeak,
    kingFileOpen,
  }
}

function gameOverText(chess: Chess): string | null {
  if (chess.isCheckmate()) return `将杀，${chess.turn() === 'w' ? '黑方' : '白方'}获胜`
  if (chess.isStalemate()) return '逼和，和棋'
  if (chess.isInsufficientMaterial()) return '子力不足，和棋'
  if (chess.isThreefoldRepetition()) return '三次重复局面，和棋'
  if (chess.isDrawByFiftyMoves()) return '五十回合规则，和棋'
  if (chess.isDraw()) return '和棋'
  return null
}

function parseFacts(chess: Chess, lines: readonly EngineLine[]): Facts {
  const moveNumber = Number.parseInt(chess.fen().split(' ')[5] ?? '1', 10) || 1
  const white = sideFacts(chess, 'w', moveNumber)
  const black = sideFacts(chess, 'b', moveNumber)
  const totalMaterial = white.material + black.material
  const minorTotal = white.minorsDeveloped + black.minorsDeveloped
  const phase: Facts['phase'] =
    totalMaterial <= 26 ? 'endgame' : moveNumber <= 12 && minorTotal <= 3 ? 'opening' : 'middlegame'
  const phaseLabel = phase === 'opening' ? '开局' : phase === 'endgame' ? '残局' : '中局'
  return {
    chess,
    turn: chess.turn(),
    phase,
    phaseLabel,
    white,
    black,
    openFiles: openFiles(chess),
    moveNumber,
    check: chess.isCheck(),
    gameOver: gameOverText(chess),
  }
}

function scoreOf(line: EngineLine | undefined): ParsedScore {
  if (!line) return {}
  if (line.whiteMate !== undefined) return { whiteMate: line.whiteMate }
  if (line.whiteCp !== undefined) return { whiteCp: line.whiteCp }
  if (line.mate !== undefined) return { whiteMate: line.whiteMate }
  if (line.cp !== undefined) return { whiteCp: line.whiteCp }
  return {}
}

function fmtEval(score: ParsedScore): string {
  if (score.whiteMate !== undefined) {
    if (score.whiteMate > 0) return `白方 ${score.whiteMate} 步杀`
    if (score.whiteMate < 0) return `黑方 ${Math.abs(score.whiteMate)} 步杀`
    return '杀棋'
  }
  if (score.whiteCp === undefined) return '暂无评估'
  const pawns = score.whiteCp / 100
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`
}

function advantageOf(score: ParsedScore): 'white' | 'black' | 'equal' {
  if (score.whiteMate !== undefined) {
    if (score.whiteMate > 0) return 'white'
    if (score.whiteMate < 0) return 'black'
  }
  if (score.whiteCp === undefined) return 'equal'
  if (score.whiteCp >= 45) return 'white'
  if (score.whiteCp <= -45) return 'black'
  return 'equal'
}

function advantageText(advantage: 'white' | 'black' | 'equal', score: ParsedScore): string {
  if (score.whiteMate !== undefined) {
    return advantage === 'white' ? '白方有强制将杀' : advantage === 'black' ? '黑方有强制将杀' : '杀棋'
  }
  if (advantage === 'equal') return '局面大致均衡'
  const cp = Math.abs(score.whiteCp ?? 0)
  const side = advantage === 'white' ? '白方' : '黑方'
  if (cp >= 300) return `${side}胜势`
  if (cp >= 120) return `${side}明显优势`
  return `${side}略优`
}

function sideLabel(side: 'white' | 'black'): string {
  return side === 'white' ? '白方' : '黑方'
}

function planFor(facts: Facts, color: Color, advantage: 'white' | 'black' | 'equal'): CoachPlan {
  const own = color === 'w' ? facts.white : facts.black
  const other = color === 'w' ? facts.black : facts.white
  const enemyColor = opposite(color)
  const ownName = colorName(color)
  const items: string[] = []
  const evalSign = advantage === 'equal' ? 0 : advantage === (color === 'w' ? 'white' : 'black') ? 1 : -1

  if (own.hanging.length > 0) {
    const target = own.hanging[0]!
    items.push(`先处理 ${target.square} 的${PIECE_NAME[target.piece]}：它正被攻击且没有保护。`)
  }
  if (evalSign > 0) {
    items.push('你已占优：主动兑子、简化局面，把优势转入可赢的残局。')
  } else if (evalSign < 0) {
    items.push('局面稍差：避免无谓兑子，制造复杂化和战术反击。')
  }
  if (own.minorsDeveloped < 3 && facts.phase !== 'endgame') {
    items.push('完成出子：优先发展轻子并尽快王车易位，不要过早出动后。')
  }
  if (own.kingSafety < 58) {
    items.push(`${ownName}王前空间偏弱：补兵盾、打开逃逸格，避免在${own.king}附近开放线路。`)
  }
  if (own.center < 45) {
    items.push(`争夺中心：用兵控制 ${color === 'w' ? 'd4/e4' : 'd5/e5'}，限制对手子力展开。`)
  }
  if (own.passed.length > 0) {
    const files = [...new Set(own.passed.map(fileOf))].join('/')
    items.push(`推进 ${files} 线通路兵，迫使对手分心防守。`)
  }
  if (other.kingSafety < 52) {
    const wing = fileIndex(other.king) >= 5 ? '王翼' : fileIndex(other.king) <= 2 ? '后翼' : '中路'
    items.push(`${colorName(enemyColor)}${wing}王城不稳：把重子调向 ${other.king} 所在方向，寻找开线或弃子攻王。`)
  }
  if (items.length < 3) {
    const open = facts.openFiles.find((file) => own.openFiles.includes(file))
    if (open) items.push(`争夺 ${open} 线：把车放到开放线上，先占线再入侵。`)
  }
  if (items.length < 3) {
    items.push('改善最被动子力的位置，保持兵形完整，等待对手先露出弱点。')
  }
  return { color, title: `${ownName}计划`, items: items.slice(0, 3) }
}

function attackingTargetsAfterMove(
  fen: string,
  line: EngineLine | undefined,
): number {
  const uci = line?.pvUci[0]
  if (!uci || uci.length < 4) return 0
  try {
    const chess = new Chess(fen)
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    const mover = move.color
    let targets = 0
    for (const piece of allPieces(chess)) {
      if (piece.color === mover) continue
      if (piece.type !== 'k' && PIECE_VALUE[piece.type] < 3) continue
      if (chess.attackers(piece.square, mover).includes(move.to)) targets++
    }
    return targets
  } catch {
    return 0
  }
}

function tacticalNotes(facts: Facts, lines: readonly EngineLine[]): string[] {
  const notes: string[] = []
  const best = lines[0]
  const bestSan = best?.pvSan[0]
  const score = scoreOf(best)
  const main = facts.turn === 'w' ? facts.white : facts.black
  const enemyColor = opposite(facts.turn)
  const enemyHeavy = allPieces(facts.chess).some((piece) => piece.color === enemyColor && (piece.type === 'q' || piece.type === 'r'))

  if (score.whiteMate !== undefined && score.whiteMate > 0 && facts.turn === 'b') {
    notes.push('白方有强制将杀，先检查所有应将资源。')
  }
  if (score.whiteMate !== undefined && score.whiteMate < 0 && facts.turn === 'w') {
    notes.push('黑方有强制将杀，先检查所有应将资源。')
  }
  if (bestSan) {
    if (bestSan.includes('#')) notes.push(`首选 ${bestSan} 是直接将杀。`)
    else if (bestSan.includes('+')) notes.push(`首选 ${bestSan} 带将军，可争取先手。`)
    if (bestSan.includes('x')) notes.push(`战术机会：${bestSan} 可以赢得子力或兑换。`)
    if (bestSan.includes('=')) notes.push(`升变战术：${bestSan} 让兵逼近升变。`)
    if (bestSan === 'O-O' || bestSan === 'O-O-O') notes.push(`${bestSan} 先完成王的安全，再展开子力。`)
  }
  if (attackingTargetsAfterMove(facts.chess.fen(), best) >= 2) {
    notes.push(`首选着法带有双击/叉子意味，落点同时攻击两个重要目标。`)
  }
  const enemy = enemyColor === 'w' ? facts.white : facts.black
  if (enemy.hanging.length > 0) {
    const target = enemy.hanging[0]!
    notes.push(`对手的 ${target.square} ${PIECE_NAME[target.piece]} 没有保护，留意吃子或先手攻击。`)
  }
  if (main.hanging.length > 0) {
    const target = main.hanging[0]!
    notes.push(`警报：你的 ${target.square} ${PIECE_NAME[target.piece]} 处于悬子状态。`)
  }
  if (main.backRankWeak && enemyHeavy) notes.push('底线存在隐患：对手重子可能沿开放线入侵。')
  if (main.kingFileOpen && main.kingSafety < 58 && enemyHeavy) notes.push('王前线路开放，注意对手的后与车。')
  if (notes.length === 0) notes.push('暂无直接战术；先改善子力位置，保留对手的弱点。')
  return [...new Set(notes)].slice(0, 4)
}

function materialText(diff: number): string {
  if (Math.abs(diff) < 0.5) return '子力基本均衡'
  if (diff > 0) return `白方多 ${diff.toFixed(1)} 分子力`
  return `黑方多 ${Math.abs(diff).toFixed(1)} 分子力`
}

function metric(
  id: string,
  label: string,
  white: number,
  black: number,
  unit?: string,
): CoachMetric {
  return { id, label, white, black, ...(unit === undefined ? {} : { unit }) }
}

function summaryOf(
  facts: Facts,
  score: ParsedScore,
  advantage: 'white' | 'black' | 'equal',
  bestSan: string | null,
): string {
  if (facts.gameOver) return facts.gameOver
  const diff = Math.round((facts.white.material - facts.black.material) * 100) / 100
  const parts: string[] = [`${facts.phaseLabel}，${advantageText(advantage, score)}（${fmtEval(score)}）。`]
  parts.push(`${materialText(diff)}。`)
  if (diff <= -0.5 && advantage !== 'black') {
    parts.push('黑方虽然多子，但白方有局面补偿；不能只看子力。')
  } else if (diff >= 0.5 && advantage !== 'white') {
    parts.push('白方虽然多子，但黑方有局面补偿；不能只看子力。')
  }
  if (Math.abs(facts.white.kingSafety - facts.black.kingSafety) >= 12) {
    parts.push(facts.white.kingSafety > facts.black.kingSafety ? '白方王城更安全。' : '黑方王城更安全。')
  }
  if (facts.check) parts.push(`${colorName(facts.turn)}正处于被将军状态，必须先应将。`)
  if (bestSan) parts.push(`引擎首选 ${bestSan}。`)
  else parts.push('等待引擎给出首选着法。')
  return parts.join('')
}

function recommendationOf(
  facts: Facts,
  lines: readonly EngineLine[],
): { move: string; text: string } {
  if (facts.gameOver) return { move: '—', text: facts.gameOver }
  const best = lines[0]
  const bestSan = best?.pvSan[0]
  if (!bestSan) return { move: '—', text: '引擎暂不可用；可先用 Lichess 云端评估，或检查 Stockfish 路径。' }
  const line = best.pvSan.slice(0, 5)
  const reply = line.slice(1).join(' ')
  const side = facts.turn === 'w' ? '白方' : '黑方'
  const aim = best.pvUci[0]?.length === 4 ? `落点 ${best.pvUci[0].slice(2, 4)}` : ''
  return {
    move: bestSan,
    text: `${side}先走 ${bestSan}${aim ? `（${aim}）` : ''}。后续示意：${reply || '保持子力协调，等待对手表态'}。`,
  }
}

function factsList(facts: Facts): string[] {
  const list: string[] = []
  const material = Math.round((facts.white.material - facts.black.material) * 100) / 100
  list.push(materialText(material))
  list.push(`白方王安全 ${facts.white.kingSafety}/100，黑方 ${facts.black.kingSafety}/100`)
  list.push(`白方出子 ${facts.white.minorsDeveloped}/4，黑方 ${facts.black.minorsDeveloped}/4`)
  const pawnIssues: string[] = []
  if (facts.white.doubled) pawnIssues.push(`白方叠兵 ${facts.white.doubled}`)
  if (facts.black.doubled) pawnIssues.push(`黑方叠兵 ${facts.black.doubled}`)
  if (facts.white.isolated) pawnIssues.push(`白方孤兵 ${facts.white.isolated}`)
  if (facts.black.isolated) pawnIssues.push(`黑方孤兵 ${facts.black.isolated}`)
  if (pawnIssues.length) list.push(pawnIssues.join('，'))
  if (facts.openFiles.length) list.push(`开放线：${facts.openFiles.slice(0, 4).join('、')}`)
  return list
}

/**
 * Build the coach report for one analysed position.
 * @param fen - the analysed FEN.
 * @param lines - engine lines, best first, already carrying White-POV scores.
 * @returns the report rendered by the coach panel.
 */
export function buildCoachReport(fen: string, lines: readonly EngineLine[]): CoachReport {
  const chess = new Chess(fen)
  const facts = parseFacts(chess, lines)
  const score = scoreOf(lines[0])
  const advantage = advantageOf(score)
  const bestSan = lines[0]?.pvSan[0] ?? null
  const recommendation = recommendationOf(facts, lines)
  return {
    summary: summaryOf(facts, score, advantage, bestSan),
    phase: facts.phase,
    phaseLabel: facts.phaseLabel,
    advantage,
    advantageText: advantageText(advantage, score),
    recommendedMove: recommendation.move,
    recommendation: recommendation.text,
    tactics: tacticalNotes(facts, lines),
    whitePlan: planFor(facts, 'w', advantage),
    blackPlan: planFor(facts, 'b', advantage),
    metrics: [
      metric('material', '子力', facts.white.material, facts.black.material, '分'),
      metric('king', '王安全', facts.white.kingSafety, facts.black.kingSafety, ''),
      metric('center', '中心控制', facts.white.center, facts.black.center, ''),
      metric('development', '出子', facts.white.minorsDeveloped, facts.black.minorsDeveloped, '/4'),
      metric('pawns', '兵结构', facts.white.pawnScore, facts.black.pawnScore, ''),
    ],
    facts: factsList(facts),
  }
}

/**
 * Normalize the two UCI spellings engines use for castling. Stockfish 17 and
 * Lichess cloud data still emit the "king takes own rook" form (`e1h1`) in
 * some lines; chess.js and the board arrow expect the king-destination form
 * (`e1g1`).
 * @param chess - position before the move.
 * @param uci - raw UCI move.
 * @returns UCI accepted by chess.js.
 */
export function normalizeUciMove(chess: Chess, uci: string): string {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return uci
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const piece = chess.get(from as Square)
  if (piece?.type !== 'k') return uci
  const fromFile = fileIndex(from as Square)
  const toFile = fileIndex(to as Square)
  if (Math.abs(toFile - fromFile) <= 1) return uci
  if (from === 'e1' && to === 'h1') return 'e1g1'
  if (from === 'e1' && to === 'a1') return 'e1c1'
  if (from === 'e8' && to === 'h8') return 'e8g8'
  if (from === 'e8' && to === 'a8') return 'e8c8'
  return uci
}

/**
 * Replay a UCI variation through chess.js, normalizing castling and stopping
 * at the first illegal move.
 * @param fen - starting FEN.
 * @param uciMoves - raw UCI moves.
 * @returns the legal prefix with normalized UCI spellings.
 */
export function normalizePv(fen: string, uciMoves: readonly string[]): string[] {
  const chess = new Chess(fen)
  const out: string[] = []
  for (const raw of uciMoves) {
    const uci = normalizeUciMove(chess, raw)
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) break
    try {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      out.push(uci)
    } catch {
      break
    }
  }
  return out
}

/**
 * Convert a UCI principal variation into SAN, stopping at the first illegal
 * move (clients tolerate partial lines, engines occasionally emit a PV that
 * runs past the actual game end).
 * @param fen - starting FEN.
 * @param uciMoves - UCI moves with the side to move first.
 * @returns SAN moves, possibly shorter than the input.
 */
export function uciToSan(fen: string, uciMoves: readonly string[]): string[] {
  const chess = new Chess(fen)
  const out: string[] = []
  for (const uci of normalizePv(fen, uciMoves)) {
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    out.push(move.san)
  }
  return out
}

/** Expose a few primitives for tests and future UI hints. */
export const __testing = {
  allPieces,
  hangingPieces,
  sideFacts,
  parseFacts,
  scoreOf,
}
