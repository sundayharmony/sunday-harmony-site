export const OUTREACH_CRON_PATH = '/api/internal/outreach-dispatch'
/** Kept for docs only. Production does not register this schedule. */
export const OUTREACH_CRON_SCHEDULE = '0 20 * * 1-5'
export const OUTREACH_CRON_ENABLED = false
/** Max provider-accepted sends per manual batch. Daily cap is enforced separately. */
export const OUTREACH_BATCH_LIMIT = 10
export const OUTREACH_CRON_BATCH_LIMIT = OUTREACH_BATCH_LIMIT

export function outreachCron(): {
  path: string
  schedule: string
  enabled: boolean
  note: string
} {
  return {
    path: OUTREACH_CRON_PATH,
    schedule: OUTREACH_CRON_SCHEDULE,
    enabled: false,
    note: 'Automatic send is off. Use Send batch on this page. Each click sends until 10 messages are accepted today. Kill switch and gates still fail closed.',
  }
}
