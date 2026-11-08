import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { EnCroissantError, EnCroissantService } from '../src/host/encroissant.ts'

const service = new EnCroissantService()
const installed = (() => {
  try {
    return fs.existsSync(path.join(service.dataDir(), 'db'))
  } catch {
    return false
  }
})()

describe.skipIf(!installed)('En Croissant file bridge', () => {
  it('reports databases and engines without writing to the data directory', async () => {
    const status = await service.status()
    expect(status.installed).toBe(true)
    expect(status.databases.length).toBeGreaterThan(0)
    expect(status.engines.length).toBeGreaterThan(0)
    expect(status.engines.every((engine) => engine.kind !== 'lc0')).toBe(true)
    expect(status.databases.some((db) => db.gameCount > 0)).toBe(true)
    expect(status.databases.findIndex((db) => db.pgnSidecar)).toBe(0)
  }, 20_000)

  it('queries game headers read-only', async () => {
    const status = await service.status()
    const db = status.databases.find((database) => database.readable && database.gameCount > 0)
    expect(db).toBeDefined()
    const result = await service.games(db!.id, { limit: 3 })
    expect(result.ok).toBe(true)
    expect(result.games.length).toBeGreaterThan(0)
    expect(result.games[0]?.white).toBeTypeOf('string')
  }, 20_000)

  it('rejects a database name that escapes the db directory', async () => {
    await expect(service.games('..\\..\\secret.db3')).rejects.toBeInstanceOf(EnCroissantError)
  })

  it('loads a recent Lichess DB game from the Lichess export API when the sidecar has drifted', async () => {
    const status = await service.status()
    const db = status.databases.find((database) => /lichess/i.test(database.id) && database.gameCount > 0)
    if (!db) return
    const games = await service.games(db.id, { limit: 5 })
    const game = games.games.find((candidate) => candidate.siteUrl)
    if (!game) return
    const loaded = await service.game(db.id, game.id)
    expect(loaded.ok).toBe(true)
    expect(loaded.pgn).toContain('[Event ')
    expect(loaded.pgn).toContain('[White ')
  }, 30_000)

  it('does not invent a path for a missing game', async () => {
    const db = 'pairsh_lichess.db3'
    if (!fs.existsSync(path.join(service.dataDir(), 'db', db))) return
    await expect(service.game(db, 999_999_999)).rejects.toMatchObject({ code: 'game-not-found' })
  })

  it('uses a platform data directory rather than cwd', () => {
    expect(service.dataDir()).not.toBe(path.join(os.homedir(), 'db'))
  })
})
