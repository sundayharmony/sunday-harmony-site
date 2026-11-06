import { isGoogleWorkspaceConfigured, workspaceMailbox } from '@/lib/google-workspace'
import { isSupabaseConfigured } from '@/lib/supabase'
import { evaluateActivationBlockers } from './activation'
import { loadCompanyPresentationPdf } from './attachment'
import { OUTREACH_MAILING_ADDRESS, OUTREACH_SENDER_EMAIL } from './constants'
import { draftContentSha256 } from './draft-shell'
import { createMemoryOutreachStore, getOutreachStore, setOutreachStoreForTests, type OutreachStore } from './store'
import { createSupabaseOutreachStore } from './supabase-store'
import type { OutreachSettings, OutreachTemplateVersion } from './types'

export { setOutreachStoreForTests }

let ephemeral: OutreachStore | null = null
let supabaseStore: OutreachStore | null = null

export function resolveOutreachStore(): OutreachStore {
  try {
    return getOutreachStore()
  } catch {
    if (isSupabaseConfigured()) {
      if (!supabaseStore) supabaseStore = createSupabaseOutreachStore()
      return supabaseStore
    }
    if (!ephemeral) ephemeral = createMemoryOutreachStore()
    return ephemeral
  }
}

export function resetEphemeralOutreachStore() {
  ephemeral = null
}

export function senderConfiguredHere(): boolean {
  return isGoogleWorkspaceConfigured() && workspaceMailbox().toLowerCase() === OUTREACH_SENDER_EMAIL
}

export function supabaseReadyForOutreach(): boolean {
  return isSupabaseConfigured()
}

export function staticUnapprovedTemplate(): OutreachTemplateVersion {
  return {
    id: 'tpl-prospect-intro-v1',
    campaignId: 'camp-prospect-intro',
    version: 1,
    subjectTemplate: '{business}: a note from Sunday Harmony',
    preheaderTemplate: 'A short note and our company presentation.',
    contentSha256: draftContentSha256(),
    approved: false,
    approvedAt: null,
    approvedBy: null,
    approvedSettingsVersion: null,
  }
}

export function defaultDisabledSettings(): OutreachSettings {
  return {
    id: 1,
    killSwitch: true,
    activatedAt: null,
    activationApprovedBy: null,
    physicalMailingAddress: OUTREACH_MAILING_ADDRESS,
    senderEmail: OUTREACH_SENDER_EMAIL,
    senderDisplayName: 'Sunday Harmony Consulting',
    signerName: 'Mac',
    companyName: 'Sunday Harmony Consulting',
    ctaLabel: 'Pick a time',
    ctaUrl: 'https://www.sundayharmony.com/book',
    dailySendLimit: 0,
    maxAttempts: 5,
    historyReconciliationStatus: 'unverified_reports_loaded',
    providerHistoryVerifiedAt: null,
    optOutVerifiedAt: null,
    settingsVersion: 1,
  }
}

export function currentBlockers(
  settings?: OutreachSettings,
  template?: OutreachTemplateVersion | null,
  extras?: { schemaReady?: boolean; attachmentPresent?: boolean }
) {
  return evaluateActivationBlockers({
    settings: settings || defaultDisabledSettings(),
    template: template === undefined ? staticUnapprovedTemplate() : template,
    senderConfigured: senderConfiguredHere(),
    unsubscribeRoutePresent: true,
    schemaReady: extras?.schemaReady ?? supabaseReadyForOutreach(),
    attachmentPresent: extras?.attachmentPresent ?? Boolean(loadCompanyPresentationPdf()),
  })
}
