import { OUTREACH_READY_QUEUE_SIZE, OUTREACH_SEND_LIMIT } from './constants'

export const OUTREACH_CRON_PATH = '/api/internal/outreach-dispatch'
/** Kept for docs only. Production does not register this schedule. */
export const OUTREACH_CRON_SCHEDULE = '0 20 * * 1-5'
export const OUTREACH_CRON_ENABLED = false
/** Manual send dispatches one letter. Kept as an alias for older tests and docs. */
export const OUTREACH_BATCH_LIMIT = OUTREACH_SEND_LIMIT
export const OUTREACH_CRON_BATCH_LIMIT = OUTREACH_SEND_LIMIT

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
    note: `Automatic send is off. Use Send on this page. Choose how many to send per action; the queue refills so ${OUTREACH_READY_QUEUE_SIZE} stay ready.`,
  }
}
