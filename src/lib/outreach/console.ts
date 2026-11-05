import { currentBlockers, senderConfiguredHere, supabaseReadyForOutreach } from './runtime'
import { EMAIL_BOT_UNVERIFIED_REPORTS } from './constants'
import { draftContentSha256 } from './draft-shell'
import { buildHandoff, canViewHandoff } from './handoff'
import type { OutreachStore } from './store'
import { deliveryStateFor } from './types'

export async function buildOutreachConsole(store: OutreachStore, role: string | null) {
  const settings = await store.getSettings()
  const campaign = await store.getCampaignBySlug('prospect-intro')
  const template = campaign ? await store.getLatestTemplate(campaign.id) : null
  const queue = await store.listQueue()
  const recon = await store.listReconciliationItems()
  const audit = await store.listAudit(50)
  const blockers = currentBlockers(settings, template)
  const includeHandoff = canViewHandoff(role)
  const items = []
  for (const item of queue) {
    const lead = includeHandoff ? await store.getLead(item.leadId) : null
    items.push({
      id: item.id,
      business: item.groundedFacts.business,
      email: includeHandoff ? item.emailRaw : item.emailNormalized.replace(/^[^@]+/, '***'),
      status: item.status,
      reason: item.eligibilityReason,
      deliveryState: deliveryStateFor(item),
      acceptedAt: item.acceptedAt,
      contactedAt: item.contactedLeadUpdatedAt,
      subject: item.subject,
      previewText: item.textBody,
      previewHtml: item.htmlBody,
      attachment: item.attachmentFilename,
      facts: item.groundedFacts,
      handoff: includeHandoff ? await buildHandoff(store, item, lead) : null,
    })
  }
  return {
    disabled: true,
    storage: supabaseReadyForOutreach() ? 'supabase' : 'ephemeral_unmigrated',
    senderConfigured: senderConfiguredHere(),
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
    },
    template: template
      ? {
          id: template.id,
          version: template.version,
          approved: template.approved,
          approvedAt: template.approvedAt,
          contentSha256: template.contentSha256,
          currentSha256: draftContentSha256(),
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
    audit: audit.map((event) => ({
      id: event.id,
      action: event.action,
      entityType: event.entityType,
      createdAt: event.createdAt,
      payload: event.payload,
    })),
    provider: {
      intended: 'gmail',
      idempotencyRecovery: false,
      note: 'Existing prospect mail uses the Gmail API. Gmail has no durable idempotency key, so timeouts and crashes after an unknown result are marked needs_review and are never auto-resent. Provider accepted is not delivered.',
    },
  }
}
