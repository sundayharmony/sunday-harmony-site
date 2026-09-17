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

describe('application dispute work reset', () => {
  it('wires a full wipe of reports, letters, and rounds', () => {
    const db = readFileSync('src/lib/dispute-letters/dispute-lifecycle-db.ts', 'utf8')
    const route = readFileSync(
      'src/app/api/admin/credit-funding/[id]/reset-dispute-work/route.ts',
      'utf8'
    )
    const panel = readFileSync('src/components/credit-funding/CreditIntelligencePanel.tsx', 'utf8')
    const rounds = readFileSync('src/components/dispute-letters/DisputeRoundsPanel.tsx', 'utf8')
    assert.match(db, /export async function resetDisputeWorkForApplication/)
    assert.match(db, /export async function backfillHistoricalRound1ForApplication/)
    assert.match(db, /from\('dispute_cases'\)\.delete\(\)/)
    assert.match(route, /resetDisputeWorkForApplication/)
    assert.match(panel, /resetApplicationDisputeWork/)
    assert.match(rounds, /Reset to before first report/)
    assert.match(rounds, /Record prior Round 1/)
    const backfillRoute = readFileSync(
      'src/app/api/admin/dispute-letters/lifecycle/backfill-round1/route.ts',
      'utf8'
    )
    assert.match(backfillRoute, /backfillHistoricalRound1ForApplication/)
  })
})

describe('credit analysis letter entry', () => {
  it('opens letters from the Dispute letters tab only', () => {
    const panel = readFileSync('src/components/credit-funding/CreditIntelligencePanel.tsx', 'utf8')
    assert.match(panel, /Dispute letters/)
    assert.doesNotMatch(panel, /Prepare letters/)
  })
})
