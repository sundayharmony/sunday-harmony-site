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

  it('replaces unsafe existing links with an https placeholder', async () => {
    const unsafe = await resolveMeetLinkForMeeting({ existingLink: 'javascript:alert(1)' })
    assert.match(unsafe, /^https:\/\/meet\.google\.com\//)

    const http = await resolveMeetLinkForMeeting({ existingLink: 'http://evil.example/meet' })
    assert.match(http, /^https:\/\/meet\.google\.com\//)

    const safe = await resolveMeetLinkForMeeting({
      existingLink: 'https://meet.google.com/aaa-bbbb-ccc',
    })
    assert.equal(safe, 'https://meet.google.com/aaa-bbbb-ccc')
  })
})
