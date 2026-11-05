import { legacyLeadStatusForStage, marketingStatusForStage, type PipelineStage } from '@/lib/marketing-pipeline'
import { getSupabase } from '@/lib/supabase'
import type { OutreachStore } from './store'
import type {
  AuditEvent,
  LeadSnapshot,
  OutreachAttempt,
  OutreachSettings,
  OutreachTemplateVersion,
  QueueItem,
  QueueStatus,
  ReconciliationItem,
  Suppression,
} from './types'
import { leadRowToSnapshot } from './enqueue'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function mapSettings(row: Record<string, unknown>): OutreachSettings {
  return {
    id: 1,
    killSwitch: row.kill_switch !== false,
    activatedAt: typeof row.activated_at === 'string' ? row.activated_at : null,
    activationApprovedBy: typeof row.activation_approved_by === 'string' ? row.activation_approved_by : null,
    physicalMailingAddress: typeof row.physical_mailing_address === 'string' ? row.physical_mailing_address : null,
    senderEmail: asString(row.sender_email) || 'sales@sundayharmony.com',
    senderDisplayName: asString(row.sender_display_name) || 'Sunday Harmony Consulting',
    signerName: asString(row.signer_name) || 'Mac',
    companyName: asString(row.company_name) || 'Sunday Harmony Consulting',
    ctaLabel: asString(row.cta_label) || 'Pick a time',
    ctaUrl: asString(row.cta_url) || 'https://www.sundayharmony.com/book',
    dailySendLimit: typeof row.daily_send_limit === 'number' ? row.daily_send_limit : 0,
    maxAttempts: typeof row.max_attempts === 'number' ? row.max_attempts : 5,
    historyReconciliationStatus:
      row.history_reconciliation_status === 'reconciled' ||
      row.history_reconciliation_status === 'unverified_reports_loaded'
        ? row.history_reconciliation_status
        : 'unknown',
    providerHistoryVerifiedAt:
      typeof row.provider_history_verified_at === 'string' ? row.provider_history_verified_at : null,
    optOutVerifiedAt: typeof row.opt_out_verified_at === 'string' ? row.opt_out_verified_at : null,
    settingsVersion: typeof row.settings_version === 'number' ? row.settings_version : 1,
  }
}

function mapTemplate(row: Record<string, unknown>): OutreachTemplateVersion {
  return {
    id: asString(row.id),
    campaignId: asString(row.campaign_id),
    version: typeof row.version === 'number' ? row.version : 1,
    subjectTemplate: asString(row.subject_template),
    preheaderTemplate: asString(row.preheader_template),
    contentSha256: asString(row.content_sha256),
    approved: row.approved === true,
    approvedAt: typeof row.approved_at === 'string' ? row.approved_at : null,
    approvedBy: typeof row.approved_by === 'string' ? row.approved_by : null,
    approvedSettingsVersion:
      typeof row.approved_settings_version === 'number' ? row.approved_settings_version : null,
  }
}

function mapQueue(row: Record<string, unknown>): QueueItem {
  return {
    id: asString(row.id),
    campaignId: asString(row.campaign_id),
    templateVersionId: asString(row.template_version_id),
    leadId: asString(row.lead_id),
    emailRaw: asString(row.email_raw),
    emailNormalized: asString(row.email_normalized),
    status: asString(row.status) as QueueStatus,
    eligibilityReason: asString(row.eligibility_reason),
    groundedFacts: (row.grounded_facts || {}) as QueueItem['groundedFacts'],
    subject: asString(row.subject),
    preheader: asString(row.preheader),
    htmlBody: asString(row.html_body),
    textBody: asString(row.text_body),
    payloadSha256: asString(row.payload_sha256),
    providerIdempotencyKey: asString(row.provider_idempotency_key),
    providerMessageId: typeof row.provider_message_id === 'string' ? row.provider_message_id : null,
    providerThreadId: typeof row.provider_thread_id === 'string' ? row.provider_thread_id : null,
    attemptCount: typeof row.attempt_count === 'number' ? row.attempt_count : 0,
    maxAttempts: typeof row.max_attempts === 'number' ? row.max_attempts : 5,
    nextAttemptAt: asString(row.next_attempt_at),
    claimedBy: typeof row.claimed_by === 'string' ? row.claimed_by : null,
    claimedAt: typeof row.claimed_at === 'string' ? row.claimed_at : null,
    leaseExpiresAt: typeof row.lease_expires_at === 'string' ? row.lease_expires_at : null,
    acceptedAt: typeof row.accepted_at === 'string' ? row.accepted_at : null,
    deliveredAt: typeof row.delivered_at === 'string' ? row.delivered_at : null,
    bouncedAt: typeof row.bounced_at === 'string' ? row.bounced_at : null,
    contactedLeadUpdatedAt:
      typeof row.contacted_lead_updated_at === 'string' ? row.contacted_lead_updated_at : null,
    attachmentFilename: asString(row.attachment_filename),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function queueWrite(item: Partial<QueueItem>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (item.campaignId) row.campaign_id = item.campaignId
  if (item.templateVersionId) row.template_version_id = item.templateVersionId
  if (item.leadId) row.lead_id = item.leadId
  if (item.emailRaw !== undefined) row.email_raw = item.emailRaw
  if (item.emailNormalized !== undefined) row.email_normalized = item.emailNormalized
  if (item.status) row.status = item.status
  if (item.eligibilityReason !== undefined) row.eligibility_reason = item.eligibilityReason
  if (item.groundedFacts) row.grounded_facts = item.groundedFacts
  if (item.subject !== undefined) row.subject = item.subject
  if (item.preheader !== undefined) row.preheader = item.preheader
  if (item.htmlBody !== undefined) row.html_body = item.htmlBody
  if (item.textBody !== undefined) row.text_body = item.textBody
  if (item.payloadSha256 !== undefined) row.payload_sha256 = item.payloadSha256
  if (item.providerIdempotencyKey !== undefined) row.provider_idempotency_key = item.providerIdempotencyKey
  if (item.providerMessageId !== undefined) row.provider_message_id = item.providerMessageId
  if (item.providerThreadId !== undefined) row.provider_thread_id = item.providerThreadId
  if (item.attemptCount !== undefined) row.attempt_count = item.attemptCount
  if (item.maxAttempts !== undefined) row.max_attempts = item.maxAttempts
  if (item.nextAttemptAt !== undefined) row.next_attempt_at = item.nextAttemptAt
  if (item.claimedBy !== undefined) row.claimed_by = item.claimedBy
  if (item.claimedAt !== undefined) row.claimed_at = item.claimedAt
  if (item.leaseExpiresAt !== undefined) row.lease_expires_at = item.leaseExpiresAt
  if (item.acceptedAt !== undefined) row.accepted_at = item.acceptedAt
  if (item.deliveredAt !== undefined) row.delivered_at = item.deliveredAt
  if (item.bouncedAt !== undefined) row.bounced_at = item.bouncedAt
  if (item.contactedLeadUpdatedAt !== undefined) row.contacted_lead_updated_at = item.contactedLeadUpdatedAt
  if (item.attachmentFilename !== undefined) row.attachment_filename = item.attachmentFilename
  row.updated_at = new Date().toISOString()
  return row
}

export function createSupabaseOutreachStore(): OutreachStore {
  const db = () => getSupabase()
  return {
    now: () => new Date(),
    async getSettings() {
      const { data, error } = await db().from('outreach_settings').select('*').eq('id', 1).maybeSingle()
      if (error || !data) throw new Error(error?.message || 'outreach_settings missing')
      return mapSettings(data as Record<string, unknown>)
    },
    async updateSettings(patch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.killSwitch !== undefined) row.kill_switch = patch.killSwitch
      if (patch.activatedAt !== undefined) row.activated_at = patch.activatedAt
      if (patch.activationApprovedBy !== undefined) row.activation_approved_by = patch.activationApprovedBy
      if (patch.physicalMailingAddress !== undefined) row.physical_mailing_address = patch.physicalMailingAddress
      if (patch.dailySendLimit !== undefined) row.daily_send_limit = patch.dailySendLimit
      if (patch.historyReconciliationStatus !== undefined) {
        row.history_reconciliation_status = patch.historyReconciliationStatus
      }
      if (patch.providerHistoryVerifiedAt !== undefined) {
        row.provider_history_verified_at = patch.providerHistoryVerifiedAt
      }
      if (patch.optOutVerifiedAt !== undefined) row.opt_out_verified_at = patch.optOutVerifiedAt
      if (patch.settingsVersion !== undefined) row.settings_version = patch.settingsVersion
      const { data, error } = await db()
        .from('outreach_settings')
        .update(row)
        .eq('id', 1)
        .select('*')
        .maybeSingle()
      if (error || !data) throw new Error(error?.message || 'settings update failed')
      return mapSettings(data as Record<string, unknown>)
    },
    async recordActivation(actorId, at) {
      const { data, error } = await db()
        .from('outreach_settings')
        .update({
          activated_at: at.toISOString(),
          activation_approved_by: actorId,
          updated_at: at.toISOString(),
        })
        .eq('id', 1)
        .is('activated_at', null)
        .select('*')
        .maybeSingle()
      if (error || !data) return null
      return mapSettings(data as Record<string, unknown>)
    },
    async getCampaignBySlug(slug) {
      const { data, error } = await db().from('outreach_campaigns').select('*').eq('slug', slug).maybeSingle()
      if (error || !data) return null
      const row = data as Record<string, unknown>
      return { id: asString(row.id), slug: asString(row.slug), name: asString(row.name) }
    },
    async getLatestTemplate(campaignId) {
      const { data, error } = await db()
        .from('outreach_template_versions')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error || !data) return null
      return mapTemplate(data as Record<string, unknown>)
    },
    async approveTemplate(templateId, actorId, expectedSha, at) {
      const settings = await this.getSettings()
      const { data, error } = await db()
        .from('outreach_template_versions')
        .update({
          approved: true,
          approved_at: at.toISOString(),
          approved_by: actorId,
          approved_settings_version: settings.settingsVersion,
        })
        .eq('id', templateId)
        .eq('content_sha256', expectedSha)
        .eq('approved', false)
        .select('*')
        .maybeSingle()
      if (error || !data) return null
      return mapTemplate(data as Record<string, unknown>)
    },
    async unapproveLatestTemplate(campaignId, reason, actorId) {
      const latest = await this.getLatestTemplate(campaignId)
      if (!latest) return null
      const { data, error } = await db()
        .from('outreach_template_versions')
        .update({
          approved: false,
          approved_at: null,
          approved_by: null,
          approved_settings_version: null,
        })
        .eq('id', latest.id)
        .select('*')
        .maybeSingle()
      if (error || !data) return null
      await this.addAudit({
        actorType: actorId ? 'staff' : 'system',
        actorId,
        action: 'template_invalidated',
        entityType: 'template',
        entityId: latest.id,
        payload: { reason },
      })
      return mapTemplate(data as Record<string, unknown>)
    },
    async findUnsubscribeTokenByQueueId(queueId) {
      const { data } = await db()
        .from('outreach_unsubscribe_tokens')
        .select('*')
        .eq('queue_id', queueId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!data) return null
      const row = data as Record<string, unknown>
      return {
        tokenHash: asString(row.token_hash),
        emailNormalized: asString(row.email_normalized),
        leadId: typeof row.lead_id === 'string' ? row.lead_id : null,
        queueId: typeof row.queue_id === 'string' ? row.queue_id : null,
        confirmedAt: typeof row.confirmed_at === 'string' ? row.confirmed_at : null,
      }
    },
    async markReconProviderConfirmed(id, providerMessageId) {
      const { data: existing } = await db()
        .from('outreach_reconciliation_items')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (!existing) return null
      const current = existing as Record<string, unknown>
      const notes = `${asString(current.notes)} Provider message ${providerMessageId}.`.trim()
      const { data, error } = await db()
        .from('outreach_reconciliation_items')
        .update({ provider_confirmed: true, notes })
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (error || !data) return null
      const items = await this.listReconciliationItems()
      return items.find((item) => item.id === id) || null
    },
    async listSuppressions() {
      const { data } = await db().from('outreach_suppressions').select('*')
      return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
        id: asString(row.id),
        emailNormalized: asString(row.email_normalized),
        reason: asString(row.reason) as Suppression['reason'],
        source: asString(row.source) as Suppression['source'],
        confirmationStatus: asString(row.confirmation_status) as Suppression['confirmationStatus'],
        notes: asString(row.notes),
        createdAt: asString(row.created_at),
      }))
    },
    async findSuppression(emailNormalized) {
      const { data } = await db()
        .from('outreach_suppressions')
        .select('*')
        .eq('email_normalized', emailNormalized)
        .limit(1)
        .maybeSingle()
      if (!data) return null
      const row = data as Record<string, unknown>
      return {
        id: asString(row.id),
        emailNormalized: asString(row.email_normalized),
        reason: asString(row.reason) as Suppression['reason'],
        source: asString(row.source) as Suppression['source'],
        confirmationStatus: asString(row.confirmation_status) as Suppression['confirmationStatus'],
        notes: asString(row.notes),
        createdAt: asString(row.created_at),
      }
    },
    async addSuppression(row) {
      const { data, error } = await db()
        .from('outreach_suppressions')
        .insert({
          email_normalized: row.emailNormalized,
          reason: row.reason,
          source: row.source,
          confirmation_status: row.confirmationStatus,
          notes: row.notes,
        })
        .select('*')
        .maybeSingle()
      if (error) {
        const existing = await this.findSuppression(row.emailNormalized)
        if (existing) return existing
        throw new Error(error.message)
      }
      const saved = data as Record<string, unknown>
      return {
        id: asString(saved.id),
        emailNormalized: asString(saved.email_normalized),
        reason: asString(saved.reason) as Suppression['reason'],
        source: asString(saved.source) as Suppression['source'],
        confirmationStatus: asString(saved.confirmation_status) as Suppression['confirmationStatus'],
        notes: asString(saved.notes),
        createdAt: asString(saved.created_at),
      }
    },
    async listReconciliationItems() {
      const { data } = await db().from('outreach_reconciliation_items').select('*')
      return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
        id: asString(row.id),
        business: asString(row.reported_business_name),
        businessNormalized: asString(row.business_normalized),
        email: typeof row.reported_email === 'string' ? row.reported_email : null,
        emailNormalized: typeof row.email_normalized === 'string' ? row.email_normalized : null,
        outcome: asString(row.reported_outcome) as ReconciliationItem['outcome'],
        reportedOn: typeof row.reported_on === 'string' ? row.reported_on : null,
        matchMethod: asString(row.match_method) as ReconciliationItem['matchMethod'],
        treatment: asString(row.treatment) as ReconciliationItem['treatment'],
        providerConfirmed: row.provider_confirmed === true,
        notes: asString(row.notes),
      }))
    },
    async findReconciliationForLead(input) {
      if (input.emailNormalized) {
        const { data } = await db()
          .from('outreach_reconciliation_items')
          .select('*')
          .eq('email_normalized', input.emailNormalized)
          .maybeSingle()
        if (data) {
          const items = await this.listReconciliationItems()
          return items.find((item) => item.emailNormalized === input.emailNormalized) || null
        }
      }
      const items = await this.listReconciliationItems()
      return (
        items.find((item) => !item.emailNormalized && item.businessNormalized === input.businessNormalized) ||
        null
      )
    },
    async getQueueItem(id) {
      const { data } = await db().from('outreach_queue').select('*').eq('id', id).maybeSingle()
      return data ? mapQueue(data as Record<string, unknown>) : null
    },
    async findQueueByLead(campaignId, leadId) {
      const { data } = await db()
        .from('outreach_queue')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('lead_id', leadId)
        .maybeSingle()
      return data ? mapQueue(data as Record<string, unknown>) : null
    },
    async findQueueByEmail(campaignId, emailNormalized) {
      const { data } = await db()
        .from('outreach_queue')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('email_normalized', emailNormalized)
        .maybeSingle()
      return data ? mapQueue(data as Record<string, unknown>) : null
    },
    async listQueue() {
      const { data } = await db().from('outreach_queue').select('*').order('created_at', { ascending: false })
      return ((data || []) as Array<Record<string, unknown>>).map(mapQueue)
    },
    async insertQueue(item) {
      const { data, error } = await db()
        .from('outreach_queue')
        .insert({
          id: item.id,
          ...queueWrite(item),
          created_at: item.createdAt,
        })
        .select('*')
        .maybeSingle()
      if (error) {
        if (/duplicate|unique/i.test(error.message)) return { ok: false, reason: 'duplicate' }
        throw new Error(error.message)
      }
      return { ok: true, item: mapQueue(data as Record<string, unknown>) }
    },
    async compareAndSwap(id, expectedStatus, patch) {
      const { data, error } = await db()
        .from('outreach_queue')
        .update(queueWrite(patch))
        .eq('id', id)
        .eq('status', expectedStatus)
        .select('*')
        .maybeSingle()
      if (error || !data) return null
      return mapQueue(data as Record<string, unknown>)
    },
    async addAttempt(row) {
      const { data, error } = await db()
        .from('outreach_attempts')
        .insert({
          id: row.id,
          queue_id: row.queueId,
          attempt_number: row.attemptNumber,
          provider: row.provider,
          provider_idempotency_key: row.providerIdempotencyKey,
          outcome: row.outcome,
          retryable: row.retryable,
          provider_message_id: row.providerMessageId,
          error_code: row.errorCode,
          error_message: row.errorMessage,
          started_at: row.startedAt,
          finished_at: row.finishedAt,
        })
        .select('*')
        .maybeSingle()
      if (error) throw new Error(error.message)
      return row
    },
    async updateAttempt(id, patch) {
      await db()
        .from('outreach_attempts')
        .update({
          outcome: patch.outcome,
          retryable: patch.retryable,
          provider_message_id: patch.providerMessageId,
          error_code: patch.errorCode,
          error_message: patch.errorMessage,
          finished_at: patch.finishedAt,
        })
        .eq('id', id)
    },
    async listAttempts(queueId) {
      const { data } = await db().from('outreach_attempts').select('*').eq('queue_id', queueId)
      return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
        id: asString(row.id),
        queueId: asString(row.queue_id),
        attemptNumber: typeof row.attempt_number === 'number' ? row.attempt_number : 0,
        provider: asString(row.provider),
        providerIdempotencyKey: asString(row.provider_idempotency_key),
        outcome: asString(row.outcome) as OutreachAttempt['outcome'],
        retryable: row.retryable === true,
        providerMessageId: typeof row.provider_message_id === 'string' ? row.provider_message_id : null,
        errorCode: typeof row.error_code === 'string' ? row.error_code : null,
        errorMessage: typeof row.error_message === 'string' ? row.error_message : null,
        startedAt: asString(row.started_at),
        finishedAt: typeof row.finished_at === 'string' ? row.finished_at : null,
      }))
    },
    async addAudit(row) {
      const event: AuditEvent = {
        id: row.id || crypto.randomUUID(),
        createdAt: row.createdAt || new Date().toISOString(),
        ...row,
      }
      await db().from('outreach_audit_events').insert({
        id: event.id,
        actor_type: event.actorType,
        actor_id: event.actorId,
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        payload: event.payload,
        created_at: event.createdAt,
      })
      return event
    },
    async listAudit(limit = 100) {
      const { data } = await db()
        .from('outreach_audit_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
        id: asString(row.id),
        actorType: asString(row.actor_type) as AuditEvent['actorType'],
        actorId: typeof row.actor_id === 'string' ? row.actor_id : null,
        action: asString(row.action),
        entityType: asString(row.entity_type),
        entityId: typeof row.entity_id === 'string' ? row.entity_id : null,
        payload: (row.payload || {}) as Record<string, unknown>,
        createdAt: asString(row.created_at),
      }))
    },
    async getLead(id) {
      const { data } = await db()
        .from('leads')
        .select(
          'id, first_name, last_name, business, email, phone, website, location_text, industry, marketing_opportunity, recommended_service, notes, pipeline_stage, last_contacted_at, gmail_thread_id, source, lead_type'
        )
        .eq('id', id)
        .maybeSingle()
      return data ? leadRowToSnapshot(data as Record<string, unknown>) : null
    },
    async listEligibleLeadCandidates() {
      const { data } = await db()
        .from('leads')
        .select(
          'id, first_name, last_name, business, email, phone, website, location_text, industry, marketing_opportunity, recommended_service, notes, pipeline_stage, last_contacted_at, gmail_thread_id, source, lead_type'
        )
        .eq('lead_type', 'marketing_lead')
      return ((data || []) as Array<Record<string, unknown>>)
        .map(leadRowToSnapshot)
        .filter((row): row is LeadSnapshot => Boolean(row))
    },
    async markLeadContacted(input) {
      const stage = input.pipelineStage as PipelineStage
      await db()
        .from('leads')
        .update({
          last_contacted_at: input.contactedAt,
          pipeline_stage: input.pipelineStage,
          marketing_lead_status: marketingStatusForStage(stage),
          status: legacyLeadStatusForStage(stage),
          gmail_thread_id: input.gmailThreadId,
          updated_at: input.contactedAt,
        })
        .eq('id', input.leadId)
    },
    async getBooking(leadId, emailNormalized) {
      const byLead = await db()
        .from('consultation_bookings')
        .select('status, starts_at, meet_link, lead_id, guest_email')
        .eq('lead_id', leadId)
        .eq('status', 'scheduled')
        .order('starts_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      const row = byLead.data as Record<string, unknown> | null
      if (row) {
        return {
          status: 'scheduled' as const,
          startsAt: typeof row.starts_at === 'string' ? row.starts_at : null,
          meetLink: typeof row.meet_link === 'string' ? row.meet_link : null,
        }
      }
      const byEmail = await db()
        .from('consultation_bookings')
        .select('status, starts_at, meet_link')
        .ilike('guest_email', emailNormalized)
        .eq('status', 'scheduled')
        .order('starts_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      const emailRow = byEmail.data as Record<string, unknown> | null
      if (!emailRow) return { status: 'none' as const, startsAt: null, meetLink: null }
      return {
        status: 'scheduled' as const,
        startsAt: typeof emailRow.starts_at === 'string' ? emailRow.starts_at : null,
        meetLink: typeof emailRow.meet_link === 'string' ? emailRow.meet_link : null,
      }
    },
    async putUnsubscribeToken(input) {
      await db().from('outreach_unsubscribe_tokens').insert({
        token_hash: input.tokenHash,
        email_normalized: input.emailNormalized,
        lead_id: input.leadId,
        queue_id: input.queueId,
      })
    },
    async findUnsubscribeToken(tokenHash) {
      const { data } = await db()
        .from('outreach_unsubscribe_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle()
      if (!data) return null
      const row = data as Record<string, unknown>
      return {
        tokenHash: asString(row.token_hash),
        emailNormalized: asString(row.email_normalized),
        leadId: typeof row.lead_id === 'string' ? row.lead_id : null,
        queueId: typeof row.queue_id === 'string' ? row.queue_id : null,
        confirmedAt: typeof row.confirmed_at === 'string' ? row.confirmed_at : null,
      }
    },
    async confirmUnsubscribeToken(tokenHash, at) {
      await db().from('outreach_unsubscribe_tokens').update({ confirmed_at: at }).eq('token_hash', tokenHash)
    },
    async acceptedCountSince(sinceIso) {
      const { data } = await db()
        .from('outreach_queue')
        .select('id')
        .not('accepted_at', 'is', null)
        .gte('accepted_at', sinceIso)
      return (data || []).length
    },
  }
}
