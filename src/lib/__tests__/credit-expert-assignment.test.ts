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

  it('assigns clients from the client header on desktop and mobile', () => {
    const page = readFileSync('src/app/admin/credit-funding/page.tsx', 'utf8')
    const nameAt = page.indexOf('<h2 className="text-xl font-bold text-brand-text">{selected.full_name}</h2>')
    const workflowAt = page.indexOf('<AdminApplicationWorkflow')
    const notesAt = page.indexOf('Internal Notes (staff only)')
    assert.ok(nameAt >= 0 && workflowAt > nameAt && notesAt > workflowAt)
    const header = page.slice(nameAt, workflowAt)
    assert.match(header, /Credit expert/)
    assert.match(header, /<select/)
    assert.match(header, /id="credit-expert"/)
    assert.match(header, /<option value="">Unassigned<\/option>/)
    assert.match(header, /assigned_expert_name/)
    assert.match(header, /Assigned to you/)
    assert.match(header, /w-full/)
    assert.match(header, /sm:w-auto/)
    assert.match(header, /onClick=\{sendAssignment\}/)
    assert.match(header, />\s*Assign\s*</)
    const saveNotesMatch = /Save notes/.exec(page.slice(notesAt))
    assert.ok(saveNotesMatch)
    const notes = page.slice(notesAt, notesAt + saveNotesMatch.index)
    assert.doesNotMatch(notes, /assigned_specialist/)
    assert.doesNotMatch(notes, /id="credit-expert"/)
    assert.doesNotMatch(page.slice(notesAt), /Save notes and assignment/)
    assert.match(page, /isAdmin && expertsLoaded && !untouchedLegacy/)
    assert.match(page, /No clients are assigned to you yet/)
    assert.match(page, /function ClientCard/)
    assert.match(page, /sm:table/)
    assert.match(page, /sm:hidden/)
    assert.doesNotMatch(page, /Assigned Specialist/)
  })
})
