import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('tradeline card layout and selection', () => {
  it('toggles selection from the card body and lays accounts three across', () => {
    const card = source('src/components/dispute-letters/TradelineCard.tsx')
    const health = source('src/components/dispute-letters/DisputeHealthStep.tsx')
    const review = source('src/components/dispute-letters/DisputeReviewStep.tsx')
    assert.match(card, /export const TRADELINE_CARD_GRID/)
    assert.match(card, /lg:grid-cols-3/)
    assert.match(card, /onSelect\(!selected\)/)
    assert.match(card, /cursor-pointer/)
    assert.match(card, /isNestedControl/)
    assert.match(health, /TRADELINE_CARD_GRID/)
    assert.match(review, /TRADELINE_CARD_GRID/)
    assert.doesNotMatch(health, /className="space-y-3"/)
  })
})
