import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isSafeHttpsMeetLink, resolveMeetLinkForMeeting } from '../google-meet'

describe('meeting link allowlist', () => {
  it('accepts https URLs and rejects other schemes', () => {
    assert.equal(isSafeHttpsMeetLink('https://meet.google.com/aaa-bbbb-ccc'), true)
    assert.equal(isSafeHttpsMeetLink('http://meet.google.com/aaa-bbbb-ccc'), false)
    assert.equal(isSafeHttpsMeetLink('javascript:alert(1)'), false)
    assert.equal(isSafeHttpsMeetLink('data:text/html,hi'), false)
    assert.equal(isSafeHttpsMeetLink('not a url'), false)
  })

  it('keeps a safe https link and drops anything else', async () => {
    assert.equal(await resolveMeetLinkForMeeting({ existingLink: 'javascript:alert(1)' }), null)
    assert.equal(await resolveMeetLinkForMeeting({ existingLink: 'http://evil.example/meet' }), null)
    assert.equal(await resolveMeetLinkForMeeting({ existingLink: '' }), null)
    assert.equal(
      await resolveMeetLinkForMeeting({ existingLink: 'https://meet.google.com/aaa-bbbb-ccc' }),
      'https://meet.google.com/aaa-bbbb-ccc'
    )
  })
})
