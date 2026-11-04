/**
 * Who receives the automatic "new credit client" email.
 *
 * Dashboard lists stay assignment-scoped. This mail is not: every credit
 * expert is told when a new credit repair / credit-and-funding application
 * arrives, including while assigned_specialist is still empty. Marketing-only
 * records are not credit clients and do not use this mailer.
 */

const CREDIT_APPLICATION_SERVICE_TYPES = new Set([
  'credit_repair',
  'credit_and_funding',
  'personal_funding',
  'business_funding',
])

export type CreditExpertNotificationApplication = {
  assigned_specialist?: string | null
  service_type?: string | null
}

export type CreditExpertNotificationManager = {
  email?: string | null
  name?: string | null
  role?: string | null
}

function normalized(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

/** True only for marketing records that are not a credit application. */
export function isMarketingOnlyNotification(
  application: CreditExpertNotificationApplication | null | undefined
): boolean {
  const service = normalized(application?.service_type)
  if (CREDIT_APPLICATION_SERVICE_TYPES.has(service)) return false
  if (!service) return false
  return service.startsWith('marketing')
}

/**
 * Recipients for the new-client expert email.
 * `assigned_specialist` is accepted so callers pass the application through,
 * and is intentionally not used to shrink the list.
 */
export function creditExpertNewClientEmailRecipients<T extends CreditExpertNotificationManager>(
  creditManagers: readonly T[],
  application?: CreditExpertNotificationApplication | null
): Array<T & { email: string; name: string }> {
  if (isMarketingOnlyNotification(application)) return []

  const seen = new Set<string>()
  const recipients: Array<T & { email: string; name: string }> = []
  for (const manager of creditManagers) {
    if (manager.role && manager.role !== 'credit_manager') continue
    const email = (manager.email || '').trim()
    if (!email) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    recipients.push({
      ...manager,
      email,
      name: (manager.name || '').trim() || email,
    })
  }
  return recipients
}
