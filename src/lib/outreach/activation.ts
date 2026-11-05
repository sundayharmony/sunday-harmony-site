import { OUTREACH_CTA_URL, OUTREACH_SENDER_EMAIL } from './constants'
import { draftContentSha256 } from './draft-shell'
import type { OutreachSettings, OutreachTemplateVersion } from './types'

export type ActivationBlocker = {
  code: string
  message: string
}

export type GateInput = {
  settings: OutreachSettings
  template: OutreachTemplateVersion | null
  env?: NodeJS.ProcessEnv
  senderConfigured?: boolean
  unsubscribeRoutePresent?: boolean
  schemaReady?: boolean
  optOutVerified?: boolean
  attachmentPresent?: boolean
}

const ADDRESS_MIN = 12

export function envKillSwitchOn(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.OUTREACH_KILL_SWITCH
  if (raw === undefined || raw.trim() === '') return true
  return raw.trim().toLowerCase() !== 'false'
}

export function envActivationAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OUTREACH_ACTIVATION_ALLOWED?.trim() === 'true'
}

export function mailingAddressIsValid(value: string | null | undefined): boolean {
  const text = (value || '').trim()
  if (!text) return false
  if (text.length < ADDRESS_MIN) return false
  return /\d/.test(text) && /[A-Za-z]/.test(text)
}

export function evaluateActivationBlockers(input: GateInput): ActivationBlocker[] {
  const env = input.env || process.env
  const blockers: ActivationBlocker[] = []
  if (input.schemaReady !== true) {
    blockers.push({
      code: 'schema_unready',
      message: 'Outreach schema is missing or unreadable. Fail closed until migration is verified.',
    })
  }
  if (envKillSwitchOn(env)) {
    blockers.push({
      code: 'kill_switch',
      message: 'Global kill switch is on. OUTREACH_KILL_SWITCH defaults to on when unset.',
    })
  }
  if (input.settings.killSwitch) {
    blockers.push({
      code: 'db_kill_switch',
      message: 'Database kill switch is on.',
    })
  }
  if (!input.settings.activatedAt) {
    blockers.push({
      code: 'not_activated',
      message: 'Explicit activation has not been recorded. Preview approval is still pending.',
    })
  }
  if (!envActivationAllowed(env)) {
    blockers.push({
      code: 'activation_env',
      message: 'OUTREACH_ACTIVATION_ALLOWED is not true. This environment must not send.',
    })
  }
  if (!input.template || !input.template.approved) {
    blockers.push({
      code: 'template_unapproved',
      message: 'Template version is unapproved. Final copy approval comes later.',
    })
  } else if (input.template.contentSha256 !== draftContentSha256()) {
    blockers.push({
      code: 'template_hash_mismatch',
      message: 'Approved template hash does not match the current draft. Re-approval is required.',
    })
  }
  if (!mailingAddressIsValid(input.settings.physicalMailingAddress)) {
    blockers.push({
      code: 'missing_mailing_address',
      message: 'Physical mailing address is missing. Activation is blocked. Do not invent an address.',
    })
  }
  if (input.settings.senderEmail.toLowerCase() !== OUTREACH_SENDER_EMAIL) {
    blockers.push({
      code: 'sender_mismatch',
      message: `Sender must be ${OUTREACH_SENDER_EMAIL}.`,
    })
  }
  if (input.senderConfigured !== true) {
    blockers.push({
      code: 'sender_unverified',
      message: 'Sender configuration could not be verified in this environment.',
    })
  }
  if (input.settings.ctaUrl !== OUTREACH_CTA_URL) {
    blockers.push({
      code: 'cta_mismatch',
      message: `CTA must remain ${OUTREACH_CTA_URL}.`,
    })
  }
  if (input.unsubscribeRoutePresent !== true) {
    blockers.push({
      code: 'unsubscribe_missing',
      message: 'Public unsubscribe route is not available.',
    })
  }
  if (input.settings.historyReconciliationStatus !== 'reconciled') {
    blockers.push({
      code: 'history_unreconciled',
      message:
        input.settings.historyReconciliationStatus === 'unknown'
          ? 'Provider history is unknown and fails closed. Reconcile before any backlog can be activated.'
          : 'Email Bot reports are loaded as unverified assertions. Provider history is not reconciled.',
    })
  }
  if (input.settings.dailySendLimit <= 0) {
    blockers.push({
      code: 'daily_limit_zero',
      message: 'Daily send limit is 0. No live send is permitted.',
    })
  }
  if (!input.settings.optOutVerifiedAt) {
    blockers.push({
      code: 'opt_out_unverified',
      message: 'Opt-out roundtrip has not been verified against stored tokens and suppression.',
    })
  }
  if (
    input.template?.approved &&
    input.template.approvedSettingsVersion !== input.settings.settingsVersion
  ) {
    blockers.push({
      code: 'settings_version_mismatch',
      message: 'Settings changed after template approval. Re-approval is required.',
    })
  }
  if (input.attachmentPresent !== true) {
    blockers.push({
      code: 'attachment_missing',
      message: 'Company presentation PDF is not available on the server.',
    })
  }
  return blockers
}

export function activationRecordBlockers(input: GateInput): ActivationBlocker[] {
  return evaluateActivationBlockers(input).filter((item) => item.code !== 'not_activated')
}

export function canRecordActivation(input: GateInput): boolean {
  return activationRecordBlockers(input).length === 0
}

export function sendsPermitted(input: GateInput): boolean {
  return evaluateActivationBlockers(input).length === 0
}

export function utcDayStartIso(at: Date): string {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())).toISOString()
}
