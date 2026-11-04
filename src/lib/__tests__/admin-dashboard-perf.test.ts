import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { PEOPLE_LIST_LIMIT } from '../people-db'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('admin dashboard list performance', () => {
  it('caps People / Today list loads and skips Stripe reconcile on the list path', () => {
    const peopleDb = source('src/lib/people-db.ts')
    assert.equal(PEOPLE_LIST_LIMIT, 200)
    assert.match(peopleDb, /limit: PEOPLE_LIST_LIMIT/)
    assert.match(peopleDb, /LEAD_LIST_SELECT/)
    assert.match(peopleDb, /CLIENT_LIST_SELECT/)
    assert.doesNotMatch(peopleDb, /reconcileStaleRepairPayments/)
  })

  it('batches marketing Today task loads instead of N+1 getTasksByClient', () => {
    const crm = source('src/lib/marketing-crm.ts')
    assert.match(crm, /getTasksByClientIds/)
    assert.doesNotMatch(crm, /clientIds\.map\(\(clientId\) => getTasksByClient/)
  })

  it('loads CRM contacts and stats from one shared source scan', () => {
    const crmDb = source('src/lib/crm-db.ts')
    const route = source('src/app/api/admin/crm/route.ts')
    assert.match(crmDb, /getCrmContactsWithStats/)
    assert.match(crmDb, /loadCrmSources/)
    assert.match(route, /getCrmContactsWithStats/)
    assert.doesNotMatch(route, /getCrmContacts\(/)
  })

  it('exposes optional limits on leads, clients, applications, and bookings helpers', () => {
    const db = source('src/lib/db.ts')
    const funding = source('src/lib/credit-funding-db.ts')
    const consult = source('src/lib/consultation-db.ts')
    assert.match(db, /export async function getLeads\(options\?:/)
    assert.match(db, /export async function getClients\(options\?:/)
    assert.match(db, /export async function getTasksByClientIds/)
    assert.match(funding, /limit\?: number/)
    assert.match(consult, /listScheduledBookings\(options\?:/)
  })
})
