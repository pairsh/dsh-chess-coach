import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { buildCoachReport, uciToSan, __testing } from '../src/host/coach.ts'
import type { EngineLine } from '../src/shared/types.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function line(partial: Partial<EngineLine> = {}): EngineLine {
  return {
    multipv: 1,
    depth: 16,
    whiteCp: 28,
    pvUci: ['e2e4', 'e7e5', 'g1f3'],
    pvSan: ['e4', 'e5', 'Nf3'],
    ...partial,
  }
}

describe('coach report', () => {
  it('summarises a normal opening position without inventing an evaluation', () => {
    const report = buildCoachReport(START, [line()])
    expect(report.summary).toContain('+0.28')
    expect(report.summary).toContain('开局')
    expect(report.recommendedMove).toBe('e4')
    expect(report.recommendation).toContain('e4')
    expect(report.whitePlan.items.length).toBeGreaterThan(0)
    expect(report.blackPlan.items.length).toBeGreaterThan(0)
    expect(report.metrics.find((metric) => metric.id === 'material')).toBeDefined()
  })

  it('reports mate from the engine score', () => {
    const report = buildCoachReport(
      '7k/6pp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
      [line({ whiteCp: undefined, whiteMate: 1, pvUci: ['e1e8'], pvSan: ['Re8#'] })],
    )
    expect(report.summary).toContain('白方有强制将杀')
    expect(report.advantage).toBe('white')
  })

  it('finds an undefended knight as a tactical alert', () => {
    const fen = '4k3/8/8/4n3/3P4/8/8/4K3 w - - 0 1'
    const chess = new Chess(fen)
    const hanging = __testing.hangingPieces(chess, 'b')
    expect(hanging.some((piece) => piece.square === 'e5' && piece.piece === 'n')).toBe(true)
    const report = buildCoachReport(fen, [line({ whiteCp: 60, pvUci: ['d4e5'], pvSan: ['dxe5'] })])
    expect(report.tactics.join(' ')).toContain('e5')
  })

  it('converts UCI principal variations to SAN and stops at illegal moves', () => {
    expect(uciToSan(START, ['e2e4', 'e7e5', 'g1f3'])).toEqual(['e4', 'e5', 'Nf3'])
    expect(uciToSan(START, ['e2e4', 'e7e5', 'g1f3', 'not-a-move'])).toEqual(['e4', 'e5', 'Nf3'])
  })

  it('normalizes king-takes-rook castling spellings from Stockfish and Lichess', () => {
    const white = 'r3k2r/8/8/8/8/8/8/R3K2R w KQ - 0 1'
    expect(uciToSan(white, ['e1h1'])).toEqual(['O-O'])
    expect(uciToSan(white, ['e1a1'])).toEqual(['O-O-O'])
    const black = 'r3k2r/8/8/8/8/8/8/4K2R b kq - 0 1'
    expect(uciToSan(black, ['e8h8'])).toEqual(['O-O'])
    expect(uciToSan(black, ['e8a8'])).toEqual(['O-O-O'])
  })
})
