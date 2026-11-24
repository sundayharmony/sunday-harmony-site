// Free-audit email sequence from sales@: step 1 (audit), step 2 (day 3), step 3 (day 7).
// Rules: claude/outreach-rules.md. Tue–Thu only, warm-up cap, bounce pause, no prices, no attachments.
import { buildAudit, auditUrl, type AuditLead } from '@/lib/icp-audit'
import { readWorkspaceThread, sendWorkspaceRawMime, workspaceGmailSendReady } from '@/lib/google-workspace'
import { legacyLeadStatusForStage, marketingStatusForStage, stageFromStorage, stageToStorage } from '@/lib/marketing-pipeline'
import { getSupabase } from '@/lib/supabase'
import { envKillSwitchOn, mailingAddressIsValid } from './activation'
import { AUDIT_SENDER_DISPLAY, AUDIT_SENDER_EMAIL, auditEmailIssues, auditLinkLoads, renderAuditEmail, renderAuditFollowUp, type AuditEmail } from './audit-email'
import { MARKETING_READ_MAILBOX } from './constants'
import { normalizeEmail } from './email-address'
import { toQuotedPrintable } from './mime'
import { lookupMx, mxBlocksSend } from './mx'
import { createUnsubscribeToken, hashUnsubscribeToken, oneClickUrlFromPageUrl, unsubscribeUrl } from './unsubscribe'

export const WARMUP_START = 75
export const WARMUP_GROWTH = 1.25
export const WARMUP_CEILING = 500
export const BOUNCE_PAUSE_RATE = 0.03
const FOLLOW_UP_DAYS: Record<2 | 3, number> = { 2: 3, 3: 4 } // step 2: 3 days after step 1; step 3: 4 days after step 2 (day 7)
const SEND_DAYS = new Set(['Tue', 'Wed', 'Thu'])

/** Day name and date in Eastern time. */
export function easternDay(at: Date): { weekday: string; date: string } {
  const weekday = at.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })
  const date = at.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  return { weekday, date }
}

export function isSendDay(at: Date): boolean {
  return SEND_DAYS.has(easternDay(at).weekday)
}

/** Daily cap: 75 on the first send day, +25% per earlier send day, up to the ceiling. */
export function warmupCap(previousSendDays: number): number {
  return Math.min(WARMUP_CEILING, Math.round(WARMUP_START * WARMUP_GROWTH ** previousSendDays))
}

export function shouldPauseForBounces(sent: number, bounced: number): boolean {
  return sent >= 10 && bounced / sent > BOUNCE_PAUSE_RATE
}

/** MIME without attachment, optionally threaded as a reply. */
export function buildAuditMime(input: { to: string; email: AuditEmail; unsubscribeUrl: string; boundary: string }): string {
  const alt = `alt_${input.boundary}`
  const encodedSubject = `=?UTF-8?B?${Buffer.from(input.email.subject, 'utf8').toString('base64')}?=`
  return [
    `From: ${AUDIT_SENDER_DISPLAY} <${AUDIT_SENDER_EMAIL}>`,
    `Reply-To: ${MARKETING_READ_MAILBOX}`,
    `To: ${input.to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `List-Unsubscribe: <${oneClickUrlFromPageUrl(input.unsubscribeUrl)}>`,
    'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    toQuotedPrintable(input.email.text),
    `--${alt}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    toQuotedPrintable(input.email.html),
    `--${alt}--`,
    '',
  ].join('\r\n')
}

type LeadRow = AuditLead & {
  email: string | null
  first_name: string | null
  pipeline_stage: string | null
  replied_at: string | null
}
type SendRow = { lead_id: string; step: number; status: string; sent_at: string; subject: string; gmail_thread_id: string | null; email: string }

const LEAD_FIELDS = 'id, business, location_text, icp_score, icp_band, icp_data, email, first_name, pipeline_stage, replied_at'
const CLOSED_STAGES = new Set(['offer_made', 'won', 'lost_nurture'])

export type AuditSendSummary = {
  ok: boolean
  reason?: string
  sendDay: string
  cap: number
  bounceCheck: { checked: number; bounced: number }
  sent: { step1: number; step2: number; step3: number }
  skipped: Record<string, number>
  paused?: string
}

async function mintUnsubscribe(email: string, leadId: string): Promise<string> {
  const token = createUnsubscribeToken()
  const { error } = await getSupabase().from('outreach_unsubscribe_tokens').insert({
    token_hash: hashUnsubscribeToken(token),
    email_normalized: email,
    lead_id: leadId,
    queue_id: null,
  })
  if (error) throw new Error(`unsubscribe_token: ${error.message}`)
  return unsubscribeUrl(token)
}

async function suppressed(email: string): Promise<boolean> {
  // "already_sent"/"already_contacted" rows come from the old intro email; the audit email still goes to them (outreach rules).
  const { data } = await getSupabase()
    .from('outreach_suppressions')
    .select('id')
    .eq('email_normalized', email)
    .in('reason', ['unsubscribe', 'complaint', 'hard_bounce', 'operator'])
    .limit(1)
  return Boolean(data && data.length)
}

/** Marks bounced step-1 sends (a mailer-daemon message in the thread) and suppresses the address. */
async function checkBounces(limit: number): Promise<{ checked: number; bounced: number }> {
  const db = getSupabase()
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString()
  const { data } = await db
    .from('audit_email_sends')
    .select('id, email, gmail_thread_id')
    .eq('status', 'sent')
    .is('bounce_checked_at', null)
    .lt('sent_at', cutoff)
    .not('gmail_thread_id', 'is', null)
    .limit(limit)
  let bounced = 0
  for (const row of (data || []) as Array<{ id: string; email: string; gmail_thread_id: string }>) {
    let isBounce = false
    try {
      const thread = await readWorkspaceThread(row.gmail_thread_id, row.email)
      isBounce = thread.messages.some((m) => /mailer-daemon|postmaster|mail delivery subsystem/i.test(m.from))
    } catch {
      continue
    }
    const now = new Date().toISOString()
    if (isBounce) {
      bounced += 1
      await db.from('audit_email_sends').update({ status: 'bounced', bounce_checked_at: now }).eq('id', row.id)
      await db.from('outreach_suppressions').insert({ email_normalized: row.email, reason: 'hard_bounce', source: 'system', confirmation_status: 'confirmed', notes: 'Bounce found in audit email Gmail thread' })
    } else {
      await db.from('audit_email_sends').update({ bounce_checked_at: now }).eq('id', row.id)
    }
  }
  return { checked: (data || []).length, bounced }
}

async function sendOne(input: {
  lead: LeadRow
  step: 1 | 2 | 3
  email: string
  threadId: string | null
  firstSubject: string | null
}): Promise<string> {
  const { lead, step, email } = input
  const db = getSupabase()
  if (await suppressed(email)) return 'suppressed'
  const mx = await lookupMx(email)
  if (mxBlocksSend(mx)) return 'no_mx'
  const audit = buildAudit(lead)
  const url = auditUrl(lead.id)
  const unsub = await mintUnsubscribe(email, lead.id)
  const rendered =
    step === 1
      ? renderAuditEmail({ audit, auditUrl: url, unsubscribeUrl: unsub, firstName: lead.first_name })
      : renderAuditFollowUp({ step, audit, auditUrl: url, unsubscribeUrl: unsub, firstSubject: input.firstSubject || `A quick look at ${lead.business}` })
  const issues = auditEmailIssues(rendered, { score: lead.icp_score, suppressed: false, auditUrl: url })
  if (issues.length) return `issues:${issues.join(',')}`
  if (step === 1 && !(await auditLinkLoads(url))) return 'audit_link_down'

  const mime = buildAuditMime({ to: email, email: rendered, unsubscribeUrl: unsub, boundary: `${lead.id.replace(/-/g, '').slice(0, 16)}${step}` })
  let sent: { id: string; threadId: string }
  try {
    sent = await sendWorkspaceRawMime({ rawMime: mime, threadId: input.threadId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'gmail_error'
    await db.from('audit_email_sends').upsert(
      { lead_id: lead.id, step, email, subject: rendered.subject, status: 'failed', error: message.slice(0, 500) },
      { onConflict: 'lead_id,step' }
    )
    return 'send_failed'
  }
  const now = new Date().toISOString()
  await db.from('audit_email_sends').upsert(
    { lead_id: lead.id, step, email, subject: rendered.subject, status: 'sent', gmail_message_id: sent.id, gmail_thread_id: sent.threadId, sent_at: now, error: null },
    { onConflict: 'lead_id,step' }
  )
  const patch: Record<string, unknown> = { last_contacted_at: now, gmail_thread_id: sent.threadId, updated_at: now }
  if (stageFromStorage(lead.pipeline_stage) === 'uncontacted') {
    patch.pipeline_stage = stageToStorage('emailed')
    patch.marketing_lead_status = marketingStatusForStage('emailed')
    patch.status = legacyLeadStatusForStage('emailed')
  }
  const { error: leadError } = await db.from('leads').update(patch).eq('id', lead.id)
  if (leadError) {
    // The email went out; keep the thread on the send row so replies can still be matched.
    await db.from('audit_email_sends').update({ error: `lead_update: ${leadError.message}`.slice(0, 500) }).eq('lead_id', lead.id).eq('step', step)
    return 'sent'
  }
  return 'sent'
}

/** One daily run: bounce check, follow-ups due, then new audits up to the warm-up cap. */
export async function runAuditSender(opts: { now?: Date; force?: boolean; deadlineMs?: number; dryRun?: boolean } = {}): Promise<AuditSendSummary> {
  const now = opts.now || new Date()
  const deadline = Date.now() + (opts.deadlineMs ?? 240_000)
  const db = getSupabase()
  const day = easternDay(now)
  const summary: AuditSendSummary = { ok: true, sendDay: day.date, cap: 0, bounceCheck: { checked: 0, bounced: 0 }, sent: { step1: 0, step2: 0, step3: 0 }, skipped: {} }
  const skip = (reason: string) => {
    summary.skipped[reason] = (summary.skipped[reason] || 0) + 1
  }

  if (!opts.force && !isSendDay(now)) return { ...summary, ok: false, reason: `not_a_send_day:${day.weekday}` }
  if (envKillSwitchOn()) return { ...summary, ok: false, reason: 'env_kill_switch' }
  const { data: settings } = await db.from('outreach_settings').select('kill_switch, physical_mailing_address').eq('id', 1).maybeSingle()
  if (!settings || settings.kill_switch) return { ...summary, ok: false, reason: 'db_kill_switch' }
  if (!mailingAddressIsValid(settings.physical_mailing_address as string)) return { ...summary, ok: false, reason: 'mailing_address' }
  const gmail = await workspaceGmailSendReady()
  if (!gmail.ok) return { ...summary, ok: false, reason: gmail.reason }

  summary.bounceCheck = await checkBounces(200)

  // Warm-up: count earlier send days, and pause if the last send day bounced too much.
  const { data: history } = await db.from('audit_email_sends').select('lead_id, step, status, sent_at, subject, gmail_thread_id, email').order('sent_at', { ascending: false }).limit(5000)
  const rows = (history || []) as SendRow[]
  const days = Array.from(new Set(rows.filter((r) => r.status !== 'failed').map((r) => easternDay(new Date(r.sent_at)).date))).filter((d) => d !== day.date)
  const lastDay = days.sort().at(-1)
  if (lastDay) {
    const last = rows.filter((r) => r.status !== 'failed' && easternDay(new Date(r.sent_at)).date === lastDay)
    if (shouldPauseForBounces(last.length, last.filter((r) => r.status === 'bounced').length)) {
      summary.paused = `bounce_rate_over_3pct_on_${lastDay}`
      await db.from('outreach_audit_events').insert({ actor_type: 'system', actor_id: 'audit-sender', action: 'audit_sender_paused', entity_type: 'campaign', payload: { lastDay, sent: last.length } })
      return { ...summary, ok: false, reason: summary.paused }
    }
  }
  const sentToday = rows.filter((r) => r.status === 'sent' && easternDay(new Date(r.sent_at)).date === day.date).length
  summary.cap = warmupCap(days.length)
  let budget = summary.cap - sentToday
  const byLead = new Map<string, SendRow[]>()
  for (const r of rows) byLead.set(r.lead_id, [...(byLead.get(r.lead_id) || []), r])

  // Follow-ups first, so a thread is never left half-done.
  for (const step of [3, 2] as const) {
    const due = rows.filter((r) => {
      if (r.step !== step - 1 || r.status !== 'sent') return false
      if (byLead.get(r.lead_id)?.some((x) => x.step === step)) return false
      return now.getTime() - new Date(r.sent_at).getTime() >= FOLLOW_UP_DAYS[step] * 86_400_000
    })
    for (const prev of due) {
      if (budget <= 0 || Date.now() > deadline) break
      const { data: lead } = await db.from('leads').select(LEAD_FIELDS).eq('id', prev.lead_id).maybeSingle()
      if (!lead) continue
      const l = lead as LeadRow
      if (l.replied_at) { skip('replied'); continue }
      if (CLOSED_STAGES.has(stageFromStorage(l.pipeline_stage))) { skip('stage_closed'); continue }
      const first = byLead.get(prev.lead_id)?.find((x) => x.step === 1)
      if (opts.dryRun) { skip(`dry_run_step${step}`); continue }
      const outcome = await sendOne({ lead: l, step, email: prev.email, threadId: prev.gmail_thread_id, firstSubject: first?.subject || null })
      if (outcome === 'sent') { summary.sent[`step${step}`] += 1; budget -= 1 } else skip(outcome)
    }
  }

  // New audits: best ICP score first.
  if (budget > 0 && Date.now() < deadline) {
    const { data: candidates } = await db
      .from('leads')
      .select(LEAD_FIELDS)
      .eq('lead_type', 'marketing_lead')
      .in('icp_band', ['call', 'email'])
      .not('email', 'is', null)
      .not('icp_data->audit', 'is', null)
      .is('replied_at', null)
      .order('icp_score', { ascending: false })
      .limit(budget + 200)
    for (const lead of (candidates || []) as LeadRow[]) {
      if (budget <= 0 || Date.now() > deadline) break
      if (byLead.has(lead.id)) continue
      if (CLOSED_STAGES.has(stageFromStorage(lead.pipeline_stage))) { skip('stage_closed'); continue }
      const email = normalizeEmail(lead.email || '')
      if (!email) { skip('bad_email'); continue }
      if (opts.dryRun) { skip('dry_run_step1'); budget -= 1; continue }
      const outcome = await sendOne({ lead, step: 1, email, threadId: null, firstSubject: null })
      if (outcome === 'sent') { summary.sent.step1 += 1; budget -= 1 } else skip(outcome)
    }
  }

  await db.from('outreach_audit_events').insert({
    actor_type: 'system', actor_id: 'audit-sender', action: 'audit_sender_batch', entity_type: 'campaign',
    payload: { ...summary },
  })
  return summary
}
