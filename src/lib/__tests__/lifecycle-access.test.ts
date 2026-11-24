import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8')

describe('letter-tracking routes check the client is assigned to the staff member', () => {
  it('PATCH checks every record it is given before acting', () => {
    const src = read('src/app/api/admin/dispute-letters/lifecycle/route.ts')
    const patch = src.slice(src.indexOf('export async function PATCH'))
    const check = patch.indexOf('lifecycleAccessDenied(session, kind')
    assert.ok(check > 0)
    for (const key of ['packageId', 'sessionId', 'letterId', 'roundId', 'itemId']) {
      assert.match(patch, new RegExp(`\\['\\w+', body\\?\\.${key}\\]`))
    }
    for (const action of ['confirmLetterPackageSent(', 'markLetterSent(', 'releaseRoundToClient(', 'updateDisputeItemStatus(']) {
      assert.ok(patch.indexOf(action) > check, `${action} runs after the access check`)
    }
  })

  it('GET by session no longer skips the check for unlinked sessions', () => {
    const src = read('src/app/api/admin/dispute-letters/lifecycle/route.ts')
    assert.match(src, /lifecycleAccessDenied\(session, 'session', sessionId\)/)
    assert.doesNotMatch(src, /if \(row\?\.application_uuid\)/)
  })

  it('responses are checked before listing or uploading', () => {
    const src = read('src/app/api/admin/dispute-letters/lifecycle/responses/route.ts')
    const post = src.slice(src.indexOf('export async function POST'))
    assert.ok(post.indexOf("lifecycleAccessDenied(session, 'round'") < post.indexOf('uploadClientFileToVault('))
    assert.match(src.slice(0, src.indexOf('export async function POST')), /lifecycleAccessDenied\(session, 'round', roundId\)/)
  })

  it('admins skip the lookup; experts are denied when a record has no client', () => {
    const src = read('src/lib/dispute-letters/lifecycle-access.ts')
    assert.match(src, /role === 'admin'\) return null/)
    assert.match(src, /if \(!applicationUuid\) return notFound/)
  })
})
