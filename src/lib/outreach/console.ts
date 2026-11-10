import { resolveCompanyPresentationPdf } from './attachment'
import {
  EMAIL_BOT_UNVERIFIED_REPORTS,
  OUTREACH_MANUAL_SEND_MAX,
  OUTREACH_READY_QUEUE_SIZE,
  OUTREACH_SENT_DESK_LIMIT,
} from './constants'
import { draftContentSha256 } from './draft-shell'
import { isClaimablePending } from './enqueue'
import { buildHandoff, canViewHandoff } from './handoff'
import { currentBlockers, senderConfiguredHere, supabaseReadyForOutreach } from './runtime'
import { outreachCron } from './scheduler'
import type { OutreachStore } from './store'
import { deliveryStateFor, gmailStatusLabel, type QueueItem } from './types'

function maskEmail(email: string, includeRaw: boolean, raw: string) {
  return includeRaw ? raw : email.replace(/^[^@]+/, '***')
}

function deskRow(
  item: Pick<
    QueueItem,
    | 'id'
    | 'emailRaw'
    | 'emailNormalized'
    | 'status'
    | 'eligibilityReason'
    | 'groundedFacts'
    | 'acceptedAt'
    | 'contactedLeadUpdatedAt'
    | 'subject'
    | 'attachmentFilename'
    | 'deliveredAt'
    | 'bouncedAt'
  >,
  includeHandoff: boolean
) {
  const deliveryState = deliveryStateFor(item)
  return {
    id: item.id,
    business: item.groundedFacts.business,
    email: maskEmail(item.emailNormalized, includeHandoff, item.emailRaw),
    status: item.status,
    reason: item.eligibilityReason,
    deliveryState,
    deliveryLabel: gmailStatusLabel(deliveryState),
    acceptedAt: item.acceptedAt,
    contactedAt: item.contactedLeadUpdatedAt,
    subject: item.subject,
    attachment: item.attachmentFilename,
  }
}

export async function buildOutreachConsole(store: OutreachStore, role: string | null) {
  const now = store.now()
  const [settings, campaign, pendingAll, sent, recon, attachment] = await Promise.all([
    store.getSettings(),
    store.getCampaignBySlug('prospect-intro'),
    store.listQueueSummaries({
      statuses: ['pending'],
      order: 'queue',
      limit: Math.max(OUTREACH_READY_QUEUE_SIZE * 5, 50),
    }),
    store.listQueueSummaries({
      statuses: ['accepted', 'delivered', 'bounced'],
      order: 'recent',
      limit: OUTREACH_SENT_DESK_LIMIT,
    }),
    store.listReconciliationItems(),
    resolveCompanyPresentationPdf(),
  ])
  const template = campaign ? await store.getLatestTemplate(campaign.id) : null
  const attachmentPresent = Boolean(attachment)
  const blockers = currentBlockers(settings, template, { schemaReady: true, attachmentPresent })
  const includeHandoff = canViewHandoff(role)
  const canOperate = role === 'admin'
  const claimable = pendingAll.filter((item) => isClaimablePending(item, now))
  const deferredCount = pendingAll.length - claimable.length
  // Prefer a claimable letter for preview; fall back so staff still see what is waiting.
  const nextSummary = claimable[0] || pendingAll[0] || null
  const nextItem = nextSummary ? await buildOutreachItem(store, nextSummary.id, role) : null
  const liveSend = blockers.length === 0
  return {
    disabled: !liveSend,
    liveSend,
    storage: supabaseReadyForOutreach() ? 'supabase' : 'ephemeral_unmigrated',
    senderConfigured: senderConfiguredHere(),
    canOperate,
    attachmentPresent,
    readyCount: claimable.length,
    deferredCount,
    readyTarget: OUTREACH_READY_QUEUE_SIZE,
    manualSendMax: OUTREACH_MANUAL_SEND_MAX,
    next: nextItem,
    sent: sent.map((item) => deskRow(item, includeHandoff)),
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
        ? 'Gmail accepts a message when you click Send. That is not the same as delivered.'
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
    ...deskRow(item, includeHandoff),
    leadId: item.leadId,
    deliveredAt: item.deliveredAt,
    bouncedAt: item.bouncedAt,
    previewText: item.textBody,
    previewHtml: item.htmlBody,
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
