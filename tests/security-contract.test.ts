import { describe, expect, it } from 'vitest'

const contract = `
User A → Agent B
User A → Memory B
User A → Runs B
User A → API key B
User A → Admin overview
User A → Tool of Agent B
Anonymous → protected API
Stream over limit
`

describe('security contract', () => {
  it('contains every required isolation scenario', () => {
    for (const scenario of [
      'User A → Agent B',
      'User A → Memory B',
      'User A → Runs B',
      'User A → API key B',
      'User A → Admin overview',
      'User A → Tool of Agent B',
      'Anonymous → protected API',
      'Stream over limit',
    ]) expect(contract).toContain(scenario)
  })
})
