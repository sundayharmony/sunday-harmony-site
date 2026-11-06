import { resolveCompanyPresentationPdf } from './attachment'
import { currentBlockers, senderConfiguredHere, supabaseReadyForOutreach } from './runtime'
import { EMAIL_BOT_UNVERIFIED_REPORTS } from './constants'
import { draftContentSha256 } from './draft-shell'
import { buildHandoff, canViewHandoff } from './handoff'
import { outreachCron } from './scheduler'
import type { OutreachStore } from './store'
import { deliveryStateFor } from './types'

export async function buildOutreachConsole(store: OutreachStore, role: string | null) {
  const settings = await store.getSettings()
  const campaign = await store.getCampaignBySlug('prospect-intro')
  const template = campaign ? await store.getLatestTemplate(campaign.id) : null
  const queue = await store.listQueue()
  const recon = await store.listReconciliationItems()
  const audit = await store.listAudit(50)
  const attachmentPresent = Boolean(await resolveCompanyPresentationPdf())
  const blockers = currentBlockers(settings, template, { schemaReady: true, attachmentPresent })
  const includeHandoff = canViewHandoff(role)
  const canOperate = role === 'admin'
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
  const liveSend = blockers.length === 0
  return {
    disabled: !liveSend,
    liveSend,
    storage: supabaseReadyForOutreach() ? 'supabase' : 'ephemeral_unmigrated',
    senderConfigured: senderConfiguredHere(),
    canOperate,
    attachmentPresent,
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
      note: liveSend
        ? 'Gmail sends through the weekday cron, up to the daily cap. Timeouts and crashes after an unknown result are needs_review and are never auto-resent. Accepted is not delivered.'
        : 'Gmail is bound only when every activation gate is satisfied. Timeouts and crashes after an unknown result are needs_review and are never auto-resent. Accepted is not delivered.',
    },
  }
}
