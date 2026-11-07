import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildBasisPrompt,
  parseBasisRewritePayload,
  rewriteBasisWithGemini,
} from '../dispute-letters/gemini-basis'

describe('gemini basis rewrite (facts-only)', () => {
  it('strips SSN-like tokens from prompts', () => {
    const prompt = buildBasisPrompt([
      {
        tradeline_id: 't1',
        creditor: 'BANK',
        mismatch_summary: 'Late on EQF only; SSN 123-45-6789 must not appear',
        evidence: 'EQF:30:2020-02',
      },
    ])
    assert.doesNotMatch(prompt, /123-45-6789/)
    assert.match(prompt, /redacted-ssn/)
    // Fact payloads must not leak DOB values; instruction text may still say "DOB".
    assert.doesNotMatch(JSON.stringify(JSON.parse(prompt.split('Facts:\n')[1])), /1988|01\/15/)
  })

  it('parses validated JSON and drops unknown ids', () => {
    const raw = JSON.stringify({
      items: [
        { tradeline_id: 't1', basis: 'EQF shows a 30-day late in 2020-02 while EXP and TUC show OK. Please reinvestigate under FCRA §611.' },
        { tradeline_id: 'evil', basis: 'Invented bureau month that should be dropped because id is unknown to the allow-list.' },
        { tradeline_id: 't2', basis: 'short' },
      ],
    })
    const out = parseBasisRewritePayload(raw, new Set(['t1', 't2']))
    assert.equal(Object.keys(out).length, 1)
    assert.ok(out.t1.includes('EQF'))
  })

  it('skips live network when allowLive is false (default economical path)', async () => {
    const previous = process.env.GEMINI_LETTER_BASIS
    process.env.GEMINI_LETTER_BASIS = '1'
    process.env.GEMINI_API_KEY = 'test-key'
    try {
      const result = await rewriteBasisWithGemini({
        facts: [{ tradeline_id: 't1', creditor: 'BANK', evidence: 'EQF:30' }],
        allowLive: false,
        fetchImpl: (async () => {
          throw new Error('network should not run')
        }) as typeof fetch,
      })
      assert.equal(result.usedGemini, false)
      assert.equal(result.error, 'gemini_basis_disabled')
    } finally {
      if (previous === undefined) delete process.env.GEMINI_LETTER_BASIS
      else process.env.GEMINI_LETTER_BASIS = previous
      delete process.env.GEMINI_API_KEY
    }
  })

  it('uses mocked fetch when allowLive is true', async () => {
    process.env.GEMINI_LETTER_BASIS = '1'
    process.env.GEMINI_API_KEY = 'test-key'
    try {
      const result = await rewriteBasisWithGemini({
        facts: [{ tradeline_id: 't1', creditor: 'BANK', mismatch_summary: 'EQF late EXP OK' }],
        allowLive: true,
        fetchImpl: (async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          items: [
                            {
                              tradeline_id: 't1',
                              basis: 'Confirmed facts only: EQF reports a late while EXP shows OK. Please update or delete unverifiable history under FCRA §611.',
                            },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200 }
          )) as typeof fetch,
      })
      assert.equal(result.usedGemini, true)
      assert.match(result.byTradelineId.t1, /Confirmed facts only/)
    } finally {
      delete process.env.GEMINI_LETTER_BASIS
      delete process.env.GEMINI_API_KEY
    }
  })
})
