import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

describe('credit report assessment', () => {
  it('does not tell staff a new upload is almost done while the old report is still on screen', () => {
    const client = readFileSync('src/lib/dispute-letters/client-api.ts', 'utf8')
    const panel = readFileSync('src/components/credit-funding/CreditIntelligencePanel.tsx', 'utf8')
    assert.doesNotMatch(client, /Almost done/)
    assert.match(client, /Assessing this upload/)
    assert.match(panel, /Scores below stay on the last completed report/)
    assert.match(panel, /accounts were not/)
    assert.match(panel, /await load\(sessionId\)/)
  })

})
