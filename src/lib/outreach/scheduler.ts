/**
 * Inert scheduler description. Do NOT copy this into vercel.json until
 * activation is explicitly authorized. Production vercel.json must stay
 * without an outreach cron.
 */
export const OUTREACH_CRON_PATH = '/api/internal/outreach-dispatch'
export const OUTREACH_CRON_SCHEDULE_EXAMPLE = '0 14 * * 1-5'
export const OUTREACH_CRON_OPT_IN = false

export function outreachCronExample(): { path: string; schedule: string; enabled: false; note: string } {
  return {
    path: OUTREACH_CRON_PATH,
    schedule: OUTREACH_CRON_SCHEDULE_EXAMPLE,
    enabled: false,
    note: 'Opt-in example only. Registering this cron would still hit DisabledProvider unless every activation gate is already satisfied.',
  }
}
