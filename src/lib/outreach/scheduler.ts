export const OUTREACH_CRON_PATH = '/api/internal/outreach-dispatch'
/** 20:00 UTC Monday–Friday: 3:00 PM Eastern in standard time. Hobby plans allow one run per day. */
export const OUTREACH_CRON_SCHEDULE = '0 20 * * 1-5'
export const OUTREACH_CRON_ENABLED = true
/** Max provider-accepted sends per cron invocation. Daily cap is enforced separately. */
export const OUTREACH_CRON_BATCH_LIMIT = 10

export function outreachCron(): {
  path: string
  schedule: string
  enabled: true
  note: string
} {
  return {
    path: OUTREACH_CRON_PATH,
    schedule: OUTREACH_CRON_SCHEDULE,
    enabled: true,
    note: 'Weekday cron at 3:00 PM Eastern. Each run sends until 10 messages are accepted today. Kill switch and activation gates still fail closed.',
  }
}
