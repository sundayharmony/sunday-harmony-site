import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { creditExpertNewClientEmailRecipients } from '../credit-expert-notification'

const experts = [
  { id: 'expert-1', name: 'Avery Cole', email: 'avery@sundayharmony.com', role: 'credit_manager' as const },
  { id: 'expert-2', name: 'Blake Nguyen', email: 'blake@sundayharmony.com', role: 'credit_manager' as const },
]

describe('new credit client expert email', () => {
  it('addresses every credit expert when the credit repair client is unassigned', () => {
    const recipients = creditExpertNewClientEmailRecipients(experts, {
      service_type: 'credit_repair',
      assigned_specialist: null,
    })
    assert.deepEqual(
      recipients.map((expert) => expert.email),
      ['avery@sundayharmony.com', 'blake@sundayharmony.com']
    )
  })

  it('still addresses every credit expert when one expert is already assigned', () => {
    for (const serviceType of ['credit_repair', 'credit_and_funding', 'personal_funding', 'business_funding']) {
      const recipients = creditExpertNewClientEmailRecipients(experts, {
        service_type: serviceType,
        assigned_specialist: 'expert-1',
      })
      assert.deepEqual(
        recipients.map((expert) => expert.email),
        ['avery@sundayharmony.com', 'blake@sundayharmony.com'],
        serviceType
      )
    }
  })

  it('keeps an empty assignment and a missing service type on the full expert list', () => {
    const recipients = creditExpertNewClientEmailRecipients(experts, {
      assigned_specialist: '   ',
    })
    assert.equal(recipients.length, experts.length)
  })

  it('does not email experts about a marketing-only client', () => {
    assert.deepEqual(
      creditExpertNewClientEmailRecipients(experts, {
        service_type: 'marketing_subscription',
        assigned_specialist: null,
      }),
      []
    )
  })

  it('drops blank addresses, duplicate experts, and non-expert roles', () => {
    const recipients = creditExpertNewClientEmailRecipients(
      [
        ...experts,
        { id: 'dup', name: 'Avery Cole', email: ' Avery@SundayHarmony.com ', role: 'credit_manager' as const },
        { id: 'blank', name: 'No Mail', email: '  ', role: 'credit_manager' as const },
        { id: 'admin-1', name: 'Admin', email: 'admin@sundayharmony.com', role: 'admin' as const },
      ],
      { service_type: 'credit_and_funding', assigned_specialist: '' }
    )
    assert.deepEqual(
      recipients.map((expert) => expert.email),
      ['avery@sundayharmony.com', 'blake@sundayharmony.com']
    )
    assert.equal(recipients[0]?.name, 'Avery Cole')
  })

  it('sends the automatic new-client email from the submission path, not the assignment filter', () => {
    const finalize = readFileSync('src/lib/credit-funding-finalize.ts', 'utf8')
    const bulk = readFileSync('src/app/api/admin/credit-funding/send-notifications/route.ts', 'utf8')

    assert.match(finalize, /creditExpertNewClientEmailRecipients\(await getCreditManagers\(\)/)
    assert.match(finalize, /sendCreditFundingExpertNotificationEmail/)
    assert.doesNotMatch(finalize, /filterCreditApplicationsForViewer/)
    assert.match(bulk, /filterCreditApplicationsForViewer/)
  })
})
