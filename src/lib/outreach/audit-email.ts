// Free-audit email for leads scoring 50+. Plain template, no AI, no prices.
import type { Audit } from '@/lib/icp-audit'
import { MARKETING_READ_MAILBOX, OUTREACH_CTA_URL, OUTREACH_MAILING_ADDRESS } from './constants'
import { copyIssues, escapeHtml } from './copy-rules'
import { htmlHasRealUnsubscribe } from './tokens'

/** Cold outreach sends from sales@ (CLAUDE.md outreach rules). */
export const AUDIT_SENDER_EMAIL = MARKETING_READ_MAILBOX
export const AUDIT_SENDER_DISPLAY = 'Sunday Harmony'
export const AUDIT_MIN_SCORE = 50

export type AuditEmail = { subject: string; preheader: string; html: string; text: string }

export function renderAuditEmail(input: {
  audit: Audit
  auditUrl: string
  unsubscribeUrl: string
  firstName?: string | null
  mailingAddress?: string
}): AuditEmail {
  const { audit } = input
  const address = (input.mailingAddress || OUTREACH_MAILING_ADDRESS).trim()
  const top = audit.findings.slice(0, 3)
  const subject = `${audit.business}: your free online audit`
  const preheader = top.length
    ? `We found ${top.length === 1 ? 'one thing' : `${top.length} things`} that may be costing you calls.`
    : 'A short look at how you show up online.'
  const intro = top.length
    ? `We put together a short, free audit of how ${audit.business} shows up online. Here ${top.length === 1 ? 'is what stood out' : 'are the things that stood out'}:`
    : `We put together a short, free audit of how ${audit.business} shows up online.`
  const strength = audit.strengths[0] || ''
  const close = 'The full audit has what we checked and how to fix each one. If it helps, pick a time and we will walk you through it. No cost and no contract.'

  const e = escapeHtml
  const p = (text: string) => `<p style="margin:0 0 14px 0;">${e(text)}</p>`
  const list = top.length
    ? `<ul style="margin:0 0 16px 0;padding-left:20px;">${top
        .map((f) => `<li style="margin:0 0 8px 0;"><strong>${e(f.title)}.</strong> ${e(f.detail)}</li>`)
        .join('')}</ul>`
    : ''
  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${e(href)}" style="display:inline-block;margin:0 8px 10px 0;padding:14px 24px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;${
      primary ? 'background:#1b1a17;color:#fbf7f0;border:1px solid #1b1a17;' : 'background:transparent;color:#1b1a17;border:1px solid #1b1a17;'
    }">${e(label)}</a>`

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:#fbf7f0;font-family:Montserrat,Arial,Helvetica,sans-serif;color:#1b1a17;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fbf7f0;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fffdf8;border:1px solid #e6dbc6;border-radius:24px;">
<tr><td style="padding:32px 32px 8px 32px;">
<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#7f6427;font-weight:600;">Free online audit</div>
<h1 style="margin:10px 0 18px 0;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:26px;line-height:1.2;letter-spacing:-0.01em;color:#1b1a17;">${e(audit.business)}</h1>
<div style="font-size:15px;line-height:1.65;color:#1b1a17;">
${p(input.firstName ? `Hi ${input.firstName},` : 'Hi,')}
${p(intro)}
${list}
${strength ? p(strength) : ''}
${p(close)}
</div>
</td></tr>
<tr><td style="padding:4px 32px 24px 32px;">${button(input.auditUrl, 'See your audit', true)}${button(OUTREACH_CTA_URL, 'Pick a time', false)}</td></tr>
<tr><td style="padding:0 32px 28px 32px;"><div style="border-top:1px solid #e6dbc6;padding-top:18px;font-size:13px;color:#5d5a55;line-height:1.6;">
<div style="font-weight:600;color:#1b1a17;">Sunday Harmony</div>
<div><a href="mailto:${e(AUDIT_SENDER_EMAIL)}" style="color:#7f6427;text-decoration:none;">${e(AUDIT_SENDER_EMAIL)}</a> · <a href="https://www.sundayharmony.com" style="color:#7f6427;text-decoration:none;">sundayharmony.com</a></div>
<div style="font-size:11px;color:#8a857d;margin-top:12px;">Not interested? <a href="${e(input.unsubscribeUrl)}" style="color:#8a857d;">Unsubscribe</a> and we will not email you again.</div>
<div style="font-size:11px;color:#8a857d;margin-top:4px;">Sunday Harmony Consulting · ${e(address)}</div>
</div></td></tr>
</table></td></tr></table></body></html>`

  const text = [
    input.firstName ? `Hi ${input.firstName},` : 'Hi,',
    intro,
    ...top.map((f) => `- ${f.title}. ${f.detail}`),
    strength,
    close,
    `See your audit: ${input.auditUrl}`,
    `Pick a time: ${OUTREACH_CTA_URL}`,
    `Sunday Harmony\n${AUDIT_SENDER_EMAIL} · sundayharmony.com`,
    `Not interested? Unsubscribe: ${input.unsubscribeUrl}\nSunday Harmony Consulting · ${address}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return { subject, preheader, html, text }
}

/** Pre-send checks that need no network. Empty list means OK to send. */
export function auditEmailIssues(email: AuditEmail, opts: { score: number | null; suppressed: boolean; auditUrl: string }): string[] {
  const issues: string[] = []
  const all = `${email.subject}\n${email.html}\n${email.text}`
  if (/\{\{|\}\}|\{[a-z_]+\}|\bundefined\b|\bnull\b|\bNaN\b/.test(all)) issues.push('blank_merge_field')
  if (!email.html.includes(OUTREACH_MAILING_ADDRESS) || !email.text.includes(OUTREACH_MAILING_ADDRESS)) issues.push('missing_postal_address')
  if (!htmlHasRealUnsubscribe(email.html)) issues.push('missing_unsubscribe')
  if (!email.html.includes(opts.auditUrl)) issues.push('missing_audit_link')
  if (/\$\s?\d/.test(all)) issues.push('price_in_email')
  if ((opts.score ?? 0) < AUDIT_MIN_SCORE) issues.push('score_below_50')
  if (opts.suppressed) issues.push('suppressed')
  for (const issue of copyIssues(email.text)) issues.push(issue)
  return issues
}

/** Pre-send check: the audit link answers 200. */
export async function auditLinkLoads(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8_000) })
    return response.ok
  } catch {
    return false
  }
}
