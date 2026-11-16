import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { prospectNoteSections } from '../prospect-notes'

const fivePoints = [
  'Region: Delaware County / Philly Suburbs, PA',
  'Opener: Steve, congratulations on the Upper Darby reopen. The site still says Coming Soon.',
  'Research: Soft reopen posts Oct 3-12 2026. Google: 4.8 from 369 (Google). Homepage is a Coming Soon lander.',
  'Objection: We are still getting settled after reopening. Perfect timing for a short punch list.',
  'Source: Leads sheet (All Leads).',
].join(' ')

describe('prospect note sections', () => {
  it('splits a lead-sheet note into labeled parts and keeps inner colons', () => {
    const sections = prospectNoteSections(fivePoints)
    assert.ok(sections)
    assert.deepEqual(
      sections.map((section) => section.label),
      ['Region', 'Opener', 'Research', 'Objection', 'Source']
    )
    assert.equal(sections[0].body, 'Delaware County / Philly Suburbs, PA')
    assert.match(sections[2].body, /Google: 4\.8 from 369/)
    assert.equal(sections[4].body, 'Leads sheet (All Leads).')
  })

  it('splits the same headings when each one is on its own line', () => {
    const sections = prospectNoteSections(fivePoints.replace(/ (Opener|Research|Objection|Source):/g, '\n$1:'))
    assert.equal(sections?.length, 5)
    assert.match(sections?.[2].body || '', /Google: 4\.8/)
  })

  it('leaves a freeform note as one paragraph', () => {
    assert.equal(prospectNoteSections('Call back Thursday after 2.'), null)
    assert.equal(prospectNoteSections(''), null)
  })
})
