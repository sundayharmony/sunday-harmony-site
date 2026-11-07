import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const MIGRATIONS_DIR = 'supabase/migrations'

describe('supabase preview migrations', () => {
  it('creates public.leads before any migration references it', () => {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort()
    const createLeads = /CREATE TABLE IF NOT EXISTS public\.leads\b/i
    const referenceLeads = /REFERENCES public\.leads\s*\(/i

    let leadsCreated = false
    for (const name of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, name), 'utf8')
      if (createLeads.test(sql)) leadsCreated = true
      if (referenceLeads.test(sql)) {
        assert.equal(
          leadsCreated,
          true,
          `${name} references public.leads before a migration creates it`
        )
      }
    }
    assert.equal(leadsCreated, true)
  })
})
