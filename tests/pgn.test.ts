import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { DEFAULT_FEN, pgnFromGame } from '../src/client/chess-utils.ts'

describe('PGN export', () => {
  it('exports a replayable PGN for the normal start position', () => {
    const pgn = pgnFromGame(DEFAULT_FEN, ['e4', 'e5', 'Nf3'], 'w')
    expect(pgn).toContain('[Event "DSH Chess Coach study"]')
    expect(pgn).toContain('1. e4 e5')
    const parsed = new Chess()
    parsed.loadPgn(pgn)
    expect(parsed.history()).toEqual(['e4', 'e5', 'Nf3'])
  })

  it('preserves a custom starting FEN through the FEN header', () => {
    const start = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'
    const pgn = pgnFromGame(start, ['e4'], 'b')
    expect(pgn).toContain('[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]')
    const parsed = new Chess()
    parsed.loadPgn(pgn)
    expect(parsed.history()).toEqual(['e4'])
    expect(parsed.getHeaders().FEN).toBe(start)
  })
})
