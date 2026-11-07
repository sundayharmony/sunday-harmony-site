import { utcDayStartIso } from './activation'
import { resolveCompanyPresentationPdf } from './attachment'
import { EMAIL_BOT_UNVERIFIED_REPORTS } from './constants'
import { draftContentSha256 } from './draft-shell'
import { buildHandoff, canViewHandoff } from './handoff'
import { currentBlockers, senderConfiguredHere, supabaseReadyForOutreach } from './runtime'
import { outreachCron } from './scheduler'
import type { OutreachStore } from './store'
import { deliveryStateFor, gmailStatusLabel } from './types'

export async function buildOutreachConsole(store: OutreachStore, role: string | null) {
  const settings = await store.getSettings()
  const campaign = await store.getCampaignBySlug('prospect-intro')
  const template = campaign ? await store.getLatestTemplate(campaign.id) : null
  const queue = await store.listQueueSummaries()
  const recon = await store.listReconciliationItems()
  const attachmentPresent = Boolean(await resolveCompanyPresentationPdf())
  const blockers = currentBlockers(settings, template, { schemaReady: true, attachmentPresent })
  const includeHandoff = canViewHandoff(role)
  const canOperate = role === 'admin'
  const sentToday = await store.acceptedCountSince(utcDayStartIso(store.now()))
  const readyCount = queue.filter((item) => item.status === 'pending').length
  const items = queue.map((item) => ({
    id: item.id,
    business: item.groundedFacts.business,
    email: includeHandoff ? item.emailRaw : item.emailNormalized.replace(/^[^@]+/, '***'),
    status: item.status,
    reason: item.eligibilityReason,
    deliveryState: deliveryStateFor(item),
    deliveryLabel: gmailStatusLabel(deliveryStateFor(item)),
    acceptedAt: item.acceptedAt,
    contactedAt: item.contactedLeadUpdatedAt,
    subject: item.subject,
    attachment: item.attachmentFilename,
  }))
  const liveSend = blockers.length === 0
  return {
    disabled: !liveSend,
    liveSend,
    storage: supabaseReadyForOutreach() ? 'supabase' : 'ephemeral_unmigrated',
    senderConfigured: senderConfiguredHere(),
    canOperate,
    attachmentPresent,
    readyCount,
    sentToday,
    scheduler: outreachCron(),
    settings: {
      killSwitch: settings.killSwitch,
      activatedAt: settings.activatedAt,
      physicalMailingAddress: settings.physicalMailingAddress,
      senderEmail: settings.senderEmail,
      signerName: settings.signerName,
      companyName: settings.companyName,
      ctaUrl: settings.ctaUrl,
      ctaLabel: settings.ctaLabel,
      dailySendLimit: settings.dailySendLimit,
      historyReconciliationStatus: settings.historyReconciliationStatus,
      optOutVerifiedAt: settings.optOutVerifiedAt,
      settingsVersion: settings.settingsVersion,
    },
    template: template
      ? {
          id: template.id,
          version: template.version,
          approved: template.approved,
          approvedAt: template.approvedAt,
          contentSha256: template.contentSha256,
          currentSha256: draftContentSha256(),
          approvedSettingsVersion: template.approvedSettingsVersion,
        }
      : null,
    blockers,
    queue: items,
    reconciliation: recon.length
      ? recon
      : EMAIL_BOT_UNVERIFIED_REPORTS.map((row) => ({
          business: row.business,
          email: row.email,
          outcome: row.outcome,
          providerConfirmed: false,
          notes: row.notes,
        })),
    provider: {
      intended: 'gmail',
      idempotencyRecovery: false,
      note: liveSend
        ? 'Gmail accepts a message when you click Send batch. That is not the same as delivered.'
        : 'Live Gmail send stays off until every server-side gate is satisfied.',
    },
  }
}

export async function buildOutreachItem(store: OutreachStore, id: string, role: string | null) {
  const item = await store.getQueueItem(id)
  if (!item) return null
  const includeHandoff = canViewHandoff(role)
  const lead = includeHandoff ? await store.getLead(item.leadId) : null
  const handoff = includeHandoff ? await buildHandoff(store, item, lead) : null
  const deliveryState = deliveryStateFor(item)
  return {
    id: item.id,
    leadId: item.leadId,
    business: item.groundedFacts.business,
    email: includeHandoff ? item.emailRaw : item.emailNormalized.replace(/^[^@]+/, '***'),
    status: item.status,
    reason: item.eligibilityReason,
    deliveryState,
    deliveryLabel: gmailStatusLabel(deliveryState),
    acceptedAt: item.acceptedAt,
    deliveredAt: item.deliveredAt,
    bouncedAt: item.bouncedAt,
    contactedAt: item.contactedLeadUpdatedAt,
    subject: item.subject,
    previewText: item.textBody,
    previewHtml: item.htmlBody,
    attachment: item.attachmentFilename,
    phone: handoff?.phone || null,
    booking: handoff?.booking || { status: 'none', startsAt: null, meetLink: null },
  }
}

export async function buildOutreachLetterForLead(store: OutreachStore, leadId: string) {
  const item = await store.findLatestQueueForLead(leadId)
  if (!item) return null
  const deliveryState = deliveryStateFor(item)
  return {
    id: item.id,
    subject: item.subject,
    previewHtml: item.htmlBody,
    deliveryState,
    deliveryLabel: gmailStatusLabel(deliveryState),
    acceptedAt: item.acceptedAt,
    deliveredAt: item.deliveredAt,
    bouncedAt: item.bouncedAt,
    contactedAt: item.contactedLeadUpdatedAt,
  }
}
