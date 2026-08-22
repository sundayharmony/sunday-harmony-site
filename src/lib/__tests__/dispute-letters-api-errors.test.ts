import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { friendlyDisputeLettersUpstreamError } from '../dispute-letters/api-client'

describe('friendlyDisputeLettersUpstreamError', () => {
  it('rewrites Railway application-not-found JSON', () => {
    const raw = JSON.stringify({
      status: 'error',
      code: 404,
      message: 'Application not found',
      request_id: 'SWZ903kWToW0ssL5LPU1MQ',
    })
    const msg = friendlyDisputeLettersUpstreamError(raw, 404)
    assert.match(msg, /analysis service is unavailable/i)
    assert.match(msg, /DISPUTE_LETTERS_API_URL/)
  })

  it('rewrites nested proxy-wrapped Railway bodies', () => {
    const inner = JSON.stringify({
      status: 'error',
      code: 404,
      message: 'Application not found',
    })
    const raw = JSON.stringify({ error: inner })
    const msg = friendlyDisputeLettersUpstreamError(raw, 404)
    assert.match(msg, /DISPUTE_LETTERS_API_URL/)
    assert.match(msg, /Render/)
  })

  it('maps opaque Internal Server Error to Supabase guidance', () => {
    const msg = friendlyDisputeLettersUpstreamError('Internal Server Error', 500)
    assert.match(msg, /SUPABASE_/i)
  })

  it('extracts FastAPI detail field', () => {
    const msg = friendlyDisputeLettersUpstreamError(
      JSON.stringify({ detail: 'Supabase is not configured on the analysis API.' }),
      500
    )
    assert.match(msg, /Supabase is not configured/)
  })

  it('passes through ordinary upstream messages', () => {
    const msg = friendlyDisputeLettersUpstreamError(
      JSON.stringify({ error: 'CURSOR_API_KEY is required' }),
      503
    )
    assert.equal(msg, 'CURSOR_API_KEY is required')
  })
})
