import { createHash } from 'node:crypto'
import {
  OUTREACH_COMPANY_NAME,
  OUTREACH_CTA_LABEL,
  OUTREACH_CTA_URL,
  OUTREACH_SENDER_EMAIL,
  OUTREACH_SIGNER_NAME,
  OUTREACH_TAGLINE,
} from './constants'
import { copyIssues, escapeHtml } from './copy-rules'
import {
  DRAFT_HTML_SHELL,
  DRAFT_PREHEADER_TEMPLATE,
  DRAFT_SUBJECT_TEMPLATE,
  DRAFT_TEXT_SHELL,
  draftContentSha256,
} from './draft-shell'
import type { GroundedFacts } from './facts'

export type RenderedDraft = {
  subject: string
  preheader: string
  html: string
  text: string
  eyebrow: string
  bodyText: string
  contentSha256: string
  copyIssues: string[]
  attachmentFilename: string
  ctaUrl: string
  ctaLabel: string
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => values[key] ?? '')
}

function lookingAtClause(facts: GroundedFacts): string {
  if (facts.location) return ` in ${facts.location}`
  return ''
}

export function buildBodyParagraphs(facts: GroundedFacts): string[] {
  const greeting = facts.firstName ? `Hi ${facts.firstName},` : 'Hi,'
  const looking = lookingAtClause(facts)
  const opener = `I came across ${facts.business}${looking}.`
  const observation = facts.observation ? facts.observation : ''
  const attached =
    'I attached our short company presentation. It covers how Sunday Harmony Consulting helps with brand, website, and Google presence.'
  const ask = 'Would you be open to a quick call? Pick a time on our site.'
  return [greeting, [opener, observation].filter(Boolean).join(' '), attached, ask]
}

export function renderDraft(input: {
  facts: GroundedFacts
  unsubscribeUrl: string
  physicalMailingAddress?: string | null
}): RenderedDraft {
  const paragraphs = buildBodyParagraphs(input.facts)
  const bodyText = paragraphs.join('\n\n')
  const bodyHtml = paragraphs.map((p) => `<p style="margin:0 0 14px 0;">${escapeHtml(p)}</p>`).join('')
  const subject = DRAFT_SUBJECT_TEMPLATE.replace('{business}', input.facts.business)
  const preheader = input.facts.observation
    ? input.facts.observation.slice(0, 90)
    : DRAFT_PREHEADER_TEMPLATE
  const address = (input.physicalMailingAddress || '').trim()
  const addressHtml = address
    ? `<div style="font-size:11px;color:#8a857d;margin-top:10px;line-height:1.5;">${escapeHtml(address)}</div>`
    : `<div style="font-size:11px;color:#8a857d;margin-top:10px;line-height:1.5;">Physical mailing address missing. Activation is blocked.</div>`
  const addressText = address ? address : 'Physical mailing address missing. Activation is blocked.'
  const values = {
    subject: escapeHtml(subject),
    preheader: escapeHtml(preheader),
    company: escapeHtml(OUTREACH_COMPANY_NAME),
    tagline: escapeHtml(OUTREACH_TAGLINE),
    eyebrow: escapeHtml(`A note for ${input.facts.business}`),
    body_html: bodyHtml,
    cta_url: escapeHtml(OUTREACH_CTA_URL),
    cta_label: escapeHtml(OUTREACH_CTA_LABEL),
    cta_note: escapeHtml('30 minutes on Google Meet. Choose a time that works.'),
    signer_name: escapeHtml(OUTREACH_SIGNER_NAME),
    sender_email: escapeHtml(OUTREACH_SENDER_EMAIL),
    unsubscribe_url: escapeHtml(input.unsubscribeUrl),
    physical_address_html: addressHtml,
    physical_address_text: addressText,
    body_text: bodyText,
  }
  const html = fill(DRAFT_HTML_SHELL, values)
  const text = fill(DRAFT_TEXT_SHELL, {
    ...values,
    subject,
    preheader,
    company: OUTREACH_COMPANY_NAME,
    tagline: OUTREACH_TAGLINE,
    signer_name: OUTREACH_SIGNER_NAME,
    sender_email: OUTREACH_SENDER_EMAIL,
    cta_url: OUTREACH_CTA_URL,
    cta_label: OUTREACH_CTA_LABEL,
    unsubscribe_url: input.unsubscribeUrl,
  })
  const issues = copyIssues(`${subject}\n${bodyText}\n${html}`)
  return {
    subject,
    preheader,
    html,
    text,
    eyebrow: `A note for ${input.facts.business}`,
    bodyText,
    contentSha256: draftContentSha256(),
    copyIssues: issues,
    attachmentFilename: 'Sunday-Harmony-Consulting-company-presentation.pdf',
    ctaUrl: OUTREACH_CTA_URL,
    ctaLabel: OUTREACH_CTA_LABEL,
  }
}

export function payloadSha256(input: { subject: string; html: string; text: string; to: string }): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}
