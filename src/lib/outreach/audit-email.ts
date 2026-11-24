// Free-audit email for leads scoring 50+. Plain template, no AI, no prices.
import type { Audit } from '@/lib/icp-audit'
import { MARKETING_READ_MAILBOX, OUTREACH_MAILING_ADDRESS } from './constants'
import { copyIssues, escapeHtml } from './copy-rules'
import { htmlHasRealUnsubscribe } from './tokens'

/** Cold outreach sends from sales@ (CLAUDE.md outreach rules). */
export const AUDIT_SENDER_EMAIL = MARKETING_READ_MAILBOX
export const AUDIT_SENDER_DISPLAY = 'Sunday Harmony'
export const AUDIT_MIN_SCORE = 50

export type AuditEmail = { subject: string; preheader: string; html: string; text: string }

/**
 * Cold first touch, built from what the research says books calls: under ~80 words,
 * one specific finding (not the whole audit), proof they're good, and an interest
 * ask ("reply yes") instead of a meeting request. Plain look; the brand lives on the audit page.
 */
export function renderAuditEmail(input: {
  audit: Audit
  auditUrl: string
  unsubscribeUrl: string
  firstName?: string | null
  mailingAddress?: string
}): AuditEmail {
  const { audit } = input
  const address = (input.mailingAddress || OUTREACH_MAILING_ADDRESS).trim()
  const top = audit.findings[0]
  const subject = `A quick look at ${audit.business}`
  const preheader = top ? `${top.title}.` : 'A short look at how you show up online.'
  const name = (input.firstName || '').trim()
  const realName = /^[A-Z][a-z'-]{1,20}$/.test(name) && !/^(not|none|owner|unknown|manager|info|n\/a|na|team|staff)$/i.test(name)
  const greeting = realName ? `Hi ${name},` : 'Hi,'
  const proof =
    audit.rating != null && audit.reviewCount != null && audit.strengths.length
      ? `${audit.business} has ${audit.rating.toFixed(1)} stars from ${audit.reviewCount} Google reviews, so customers clearly like your work.`
      : `I took a look at how ${audit.business} shows up online.`
  const deepNote = !top
    ? ['website', 'google', 'systems', 'marketing', 'social', 'branding']
        .map((key) => audit.areas?.find((a) => a.key === key)?.checks.find((c) => c.status === 'fail')?.note)
        .find(Boolean)
    : null
  const finding = top ? `One thing stood out: ${top.hook}. ${top.detail}` : deepNote ? `One thing stood out: ${deepNote}` : ''
  const others = audit.findings.length - 1
  const auditLine = top || deepNote
    ? others > 0
      ? `I put the fix, plus ${others === 1 ? 'one other thing' : `${others} other things`} worth fixing, in a short free audit:`
      : 'I put the fix and what we would do first in a short free audit:'
    : 'I put what we checked in a short free audit:'
  const ask = 'Worth a 10-minute walk-through? Just reply "yes".'

  return shell({
    subject,
    preheader,
    address,
    unsubscribeUrl: input.unsubscribeUrl,
    paragraphs: [greeting, proof, finding, { text: auditLine, url: input.auditUrl }, ask],
  })
}

/** Shared plain email shell: paragraphs, signature, unsubscribe and postal address. */
function shell(input: {
  subject: string
  preheader: string
  address: string
  unsubscribeUrl: string
  paragraphs: Array<string | { text: string; url: string }>
}): AuditEmail {
  const e = escapeHtml
  const parts = input.paragraphs.filter((part) => (typeof part === 'string' ? part.trim() : part.text))
  const htmlPart = (part: string | { text: string; url: string }) =>
    typeof part === 'string'
      ? e(part)
      : `${e(part.text)} <a href="${e(part.url)}" style="color:#7f6427;">${e(part.url)}</a>`
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${e(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1b1a17;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(input.preheader)}</div>
<div style="max-width:560px;padding:20px 16px;font-size:15px;line-height:1.6;">
${parts.map((part) => `<p style="margin:0 0 14px 0;">${htmlPart(part)}</p>`).join('\n')}
<p style="margin:18px 0 0 0;"><span style="font-family:Georgia,serif;font-weight:600;color:#1b1a17;">Sunday Harmony</span><br><span style="font-size:13px;color:#7f6427;">Brand, strategy, and systems · sundayharmony.com</span></p>
<p style="margin:24px 0 0 0;font-size:11px;color:#8a857d;">Not interested? <a href="${e(input.unsubscribeUrl)}" style="color:#8a857d;">Unsubscribe</a> and we will not email you again.<br>Sunday Harmony Consulting · ${e(input.address)}</p>
</div></body></html>`
  const text = [
    ...parts.map((part) => (typeof part === 'string' ? part : `${part.text} ${part.url}`)),
    'Sunday Harmony\nBrand, strategy, and systems · sundayharmony.com',
    `Not interested? Unsubscribe: ${input.unsubscribeUrl}\nSunday Harmony Consulting · ${input.address}`,
  ].join('\n\n')
  return { subject: input.subject, preheader: input.preheader, html, text }
}

/**
 * Follow-ups 2 (day 3) and 3 (day 7), sent as replies in the same thread.
 * Short bumps: one reminder of the finding, the link, the same interest ask; step 3 is a polite last note.
 */
export function renderAuditFollowUp(input: {
  step: 2 | 3
  audit: Audit
  auditUrl: string
  unsubscribeUrl: string
  firstSubject: string
  mailingAddress?: string
}): AuditEmail {
  const address = (input.mailingAddress || OUTREACH_MAILING_ADDRESS).trim()
  const subject = /^re:/i.test(input.firstSubject) ? input.firstSubject : `Re: ${input.firstSubject}`
  const hook = topHook(input.audit)
  if (input.step === 2) {
    return shell({
      subject,
      preheader: 'Quick follow-up on your free audit.',
      address,
      unsubscribeUrl: input.unsubscribeUrl,
      paragraphs: [
        'Hi,',
        hook
          ? `Quick follow-up on the free audit for ${input.audit.business}. The first fix I would make: ${hook}.`
          : `Quick follow-up on the free audit for ${input.audit.business}.`,
        { text: 'It is all here:', url: input.auditUrl },
        'Want me to walk you through it? Just reply "yes".',
      ],
    })
  }
  return shell({
    subject,
    preheader: 'Last note from me.',
    address,
    unsubscribeUrl: input.unsubscribeUrl,
    paragraphs: [
      'Hi,',
      `Last note from me. If now is not the right time, no problem. The audit for ${input.audit.business} stays up here:`,
      { text: 'Your audit:', url: input.auditUrl },
      'If you want help with it, reply "yes" or call (609) 400-4459.',
    ],
  })
}

/** The single most important problem, as a short sentence fragment. */
function topHook(audit: Audit): string {
  if (audit.findings[0]) return audit.findings[0].hook
  const order = ['website', 'google', 'systems', 'marketing', 'social', 'branding']
  for (const key of order) {
    const check = audit.areas?.find((a) => a.key === key)?.checks.find((c) => c.status === 'fail')
    if (check) return check.label.toLowerCase()
  }
  return ''
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
