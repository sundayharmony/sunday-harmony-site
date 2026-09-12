import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

describe('letter generate client uses start+poll', () => {
  it('does not treat a dropped SSE stream as success', () => {
    const client = readFileSync('src/lib/dispute-letters/client-api.ts', 'utf8')
    const confirm = readFileSync('src/components/dispute-letters/DisputeConfirmStep.tsx', 'utf8')
    assert.match(client, /\/generate/)
    assert.match(client, /letterGenerateFailure/)
    assert.doesNotMatch(confirm, /streamGenerateDisputeLetters/)
    assert.match(confirm, /generateDisputeLetters/)
    const pythonMain = readFileSync('services/dispute-letters-api/app/main.py', 'utf8')
    assert.match(pythonMain, /\/internal\/letters\/generate\/start/)
    assert.doesNotMatch(pythonMain, /upload_storage_bytes/)
  })
})
