import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  creditApplicationAccessDenied,
  creditExpertOwnsApplication,
  expertDisplayName,
  filterCreditApplicationsForViewer,
  viewerMayAccessCreditApplication,
} from '../credit-expert-assignment'

const apps = [
  { id: 'a', assigned_specialist: 'expert-1' },
  { id: 'b', assigned_specialist: 'Jordan Lee' },
  { id: 'c', assigned_specialist: null },
]

describe('credit expert assignment', () => {
  it('matches only the expert user id stored on the application', () => {
    assert.equal(creditExpertOwnsApplication('expert-1', 'expert-1'), true)
    assert.equal(creditExpertOwnsApplication(' expert-1 ', 'expert-1'), true)
    assert.equal(creditExpertOwnsApplication('Jordan Lee', 'expert-1'), false)
    assert.equal(creditExpertOwnsApplication('', 'expert-1'), false)
    assert.equal(creditExpertOwnsApplication('expert-1', ''), false)
  })

  it('lets admins see every client and experts see only their own', () => {
    assert.equal(viewerMayAccessCreditApplication(apps[2], { role: 'admin', userId: 'admin-1' }), true)
    assert.equal(viewerMayAccessCreditApplication(apps[0], { role: 'credit_manager', userId: 'expert-1' }), true)
    assert.equal(viewerMayAccessCreditApplication(apps[1], { role: 'credit_manager', userId: 'expert-1' }), false)
    assert.deepEqual(
      filterCreditApplicationsForViewer(apps, { role: 'credit_manager', userId: 'expert-1' }).map((app) => app.id),
      ['a']
    )
    assert.deepEqual(
      filterCreditApplicationsForViewer(apps, { role: 'credit_manager' }).map((app) => app.id),
      []
    )
    assert.equal(filterCreditApplicationsForViewer(apps, { role: 'admin' }).length, 3)
  })

  it('returns 404 Application not found for a client the expert does not own', async () => {
    const denied = creditApplicationAccessDenied(
      { role: 'credit_manager', userId: 'expert-1' },
      apps[2]
    )
    assert.ok(denied)
    assert.equal(denied.status, 404)
    assert.equal((await denied.json()).error, 'Application not found')
    const missing = creditApplicationAccessDenied({ role: 'credit_manager', userId: 'expert-1' }, null)
    assert.equal(missing?.status, 404)
    assert.equal(
      creditApplicationAccessDenied({ role: 'admin', userId: 'admin-1' }, apps[2]),
      null
    )
  })

  it('shows a name only when the stored id matches an expert', () => {
    const experts = [{ id: 'expert-1', name: 'Avery Cole' }]
    assert.equal(expertDisplayName(experts, 'expert-1'), 'Avery Cole')
    assert.equal(expertDisplayName(experts, 'Jordan Lee'), '')
    assert.equal(expertDisplayName(experts, ''), '')
  })

  it('assigns clients from a credit expert menu on desktop and mobile', () => {
    const page = readFileSync('src/app/admin/credit-funding/page.tsx', 'utf8')
    assert.match(page, /Credit expert/)
    assert.match(page, /<select/)
    assert.match(page, /No clients are assigned to you yet/)
    assert.match(page, /function ClientCard/)
    assert.match(page, /sm:table/)
    assert.match(page, /sm:hidden/)
    assert.match(page, /<option value="">Unassigned<\/option>/)
    assert.match(page, /assigned_expert_name/)
    assert.doesNotMatch(page, /Assigned Specialist/)
    assert.match(page, /isAdmin && expertsLoaded/)
    assert.match(page, /sm:w-auto/)
  })
})
