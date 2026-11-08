import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { discoverStockfish, StockfishService } from '../src/host/engine.ts'

const candidates = discoverStockfish(process.env.DSH_CHESS_STOCKFISH)
const enginePath = candidates[0]?.path
const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-chess-coach-')), 'state.json')
const service = new StockfishService({ enginePath, stateFile })

afterAll(async () => {
  await service.dispose()
})

describe.skipIf(!enginePath)('Stockfish integration', () => {
  it('starts, identifies itself, and analyses the start position', async () => {
    const status = await service.probe()
    expect(status.available).toBe(true)
    expect(status.name.toLowerCase()).toContain('stockfish')

    const result = await service.analyze({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      depth: 10,
      multipv: 2,
    })
    expect(result.bestmove).toBeTruthy()
    expect(result.lines.length).toBeGreaterThan(0)
    expect(result.lines[0]?.pvSan.length).toBeGreaterThan(0)
    expect(result.depth).toBeGreaterThanOrEqual(8)
    expect(result.lines[0]?.whiteCp).toBeTypeOf('number')
  }, 30_000)

  it('supersedes an older search instead of queueing stale work', async () => {
    await service.probe()
    const first = service.analyze({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      depth: 30,
      multipv: 1,
    })
    const firstOutcome = first.then(() => null, (error: unknown) => error)
    await new Promise<void>((resolve) => setTimeout(resolve, 120))
    const second = service.analyze({
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 1 1',
      depth: 8,
      multipv: 1,
    })
    const result = await second
    const firstError = await firstOutcome
    expect(firstError).toBeInstanceOf(Error)
    expect((firstError as Error).message).toMatch(/replaced|superseded/i)
    expect(result.lines[0]?.pvSan.length).toBeGreaterThan(0)
  }, 30_000)
})
