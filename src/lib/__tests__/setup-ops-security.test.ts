import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { timingSafeStringEqual } from '../timing-safe'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('Area 12 setup and ops lockdown', () => {
  it('compares bootstrap and cron secrets with timing-safe equality', () => {
    assert.equal(timingSafeStringEqual('same-secret', 'same-secret'), true)
    assert.equal(timingSafeStringEqual('same-secret', 'different-secret'), false)
    assert.equal(timingSafeStringEqual('', ''), false)

    const setupRoute = source('src/app/api/setup/route.ts')
    const cronRoute = source('src/app/api/internal/cleanup-credit-funding-staging/route.ts')
    assert.match(setupRoute, /timingSafeStringEqual\(String\(body\.token \|\| ''\), setupToken\)/)
    assert.doesNotMatch(setupRoute, /body\.token !== setupToken/)
    assert.match(cronRoute, /timingSafeStringEqual\(request\.headers\.get\('authorization'\), `Bearer \$\{cronSecret\}`\)/)
  })

  it('reports setup seed outcomes without claiming skipped seeds succeeded', () => {
    const db = source('src/lib/db.ts')
    const setupRoute = source('src/app/api/setup/route.ts')

    assert.match(db, /type SeedAdminResult/)
    assert.match(db, /reason: 'missing_admin_password'/)
    assert.match(setupRoute, /const result = await seedAdmin\(\)/)
    assert.match(setupRoute, /seeded: false/)
    assert.match(setupRoute, /Admin seed was skipped/)
  })

  it('removes unused setup wrappers and ignores local diagnostic dumps', () => {
    assert.doesNotMatch(source('src/lib/auth.ts'), /ensureSeedAdmin/)
    assert.doesNotMatch(source('src/app/api/setup/route.ts'), /Bug fix: add try-catch around seedAdmin/)
    assert.match(source('.gitignore'), /diagnostic-report\.\*/)
  })
})
