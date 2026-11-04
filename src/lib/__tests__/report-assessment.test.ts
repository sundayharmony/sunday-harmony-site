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

  it('closes the Cursor SDK client with aclose instead of close', () => {
    const client = readFileSync('services/dispute-letters-api/app/services/cursor_client.py', 'utf8')
    assert.match(client, /aclose_sdk_client/)
    assert.doesNotMatch(client, /client\.close\(/)
  })
})
