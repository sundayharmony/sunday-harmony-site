import { getSupabase } from '@/lib/supabase'
import {
  computeDeadlineAt,
  expandTradelineSelections,
  isRoundClosedForNext,
  itemIdentityFromTradeline,
  nextRoundNumber,
  notYetDisputedFromItems,
  pendingIdentitiesFromTradelines,
  pendingQueueFromItems,
  type DisputeCaseRow,
  type DisputeCfpbEscalationRow,
  type DisputeCfpbStatus,
  type DisputeItemRow,
  type DisputeItemStatus,
  type DisputeLifecycleSnapshot,
  type DisputeMailMethod,
  type DisputePacketChecklist,
  type DisputeResponseRow,
  type DisputeResponseSource,
  type DisputeRoundRow,
  type DisputeRoundStatus,
} from '@/lib/dispute-letters/dispute-lifecycle'
import { listDisputeSessionsForApplication } from '@/lib/dispute-letters/db'
import type { Tradeline } from '@/lib/dispute-letters/types'

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  )
}

export async function getOrCreateDisputeCase(
  applicationUuid: string | null | undefined
): Promise<DisputeCaseRow | null> {
  const db = getSupabase()
  const now = new Date().toISOString()

  if (applicationUuid) {
    const { data: existing, error: findErr } = await db
      .from('dispute_cases')
      .select('*')
      .eq('application_uuid', applicationUuid)
      .maybeSingle()

    if (findErr) {
      if (isMissingRelation(findErr)) return null
      console.error('getOrCreateDisputeCase find error:', findErr)
      return null
    }
    if (existing) return existing as DisputeCaseRow

    const { data: created, error: createErr } = await db
      .from('dispute_cases')
      .insert({
        application_uuid: applicationUuid,
        status: 'active',
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (createErr) {
      const { data: raced } = await db
        .from('dispute_cases')
        .select('*')
        .eq('application_uuid', applicationUuid)
        .maybeSingle()
      if (raced) return raced as DisputeCaseRow
      console.error('getOrCreateDisputeCase create error:', createErr)
      return null
    }
    return created as DisputeCaseRow
  }

  const { data: created, error } = await db
    .from('dispute_cases')
    .insert({
      application_uuid: null,
      status: 'active',
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error) {
    if (isMissingRelation(error)) return null
    console.error('getOrCreateDisputeCase standalone create error:', error)
    return null
  }
  return created as DisputeCaseRow
}

export async function listRoundsForCase(caseId: string): Promise<DisputeRoundRow[]> {
  const { data, error } = await getSupabase()
    .from('dispute_rounds')
    .select('*')
    .eq('case_id', caseId)
    .order('round_number', { ascending: true })

  if (error) {
    if (!isMissingRelation(error)) console.error('listRoundsForCase error:', error)
    return []
  }
  return (data || []) as DisputeRoundRow[]
}

export async function listItemsForCase(caseId: string): Promise<DisputeItemRow[]> {
  const { data, error } = await getSupabase()
    .from('dispute_items')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })

  if (error) {
    if (!isMissingRelation(error)) console.error('listItemsForCase error:', error)
    return []
  }
  return (data || []) as DisputeItemRow[]
}

export async function loadDisputeLifecycleForApplication(
  applicationUuid: string
): Promise<DisputeLifecycleSnapshot> {
  const empty: DisputeLifecycleSnapshot = {
    case: null,
    rounds: [],
    items: [],
    notYetDisputed: [],
    pendingQueue: [],
    activeRound: null,
  }

  const { data: caseRow, error } = await getSupabase()
    .from('dispute_cases')
    .select('*')
    .eq('application_uuid', applicationUuid)
    .maybeSingle()

  if (error) {
    if (!isMissingRelation(error)) console.error('loadDisputeLifecycleForApplication error:', error)
    return empty
  }
  if (!caseRow) return empty

  const disputeCase = caseRow as DisputeCaseRow
  await seedPendingItemsFromLatestReport(applicationUuid, disputeCase.id)
  const rounds = await listRoundsForCase(disputeCase.id)
  const items = await listItemsForCase(disputeCase.id)
  const activeRound =
    [...rounds].reverse().find((r) => r.status === 'draft' || r.status === 'letters_ready') ||
    rounds[rounds.length - 1] ||
    null

  return {
    case: disputeCase,
    rounds,
    items,
    notYetDisputed: notYetDisputedFromItems(items),
    pendingQueue: pendingQueueFromItems(items),
    activeRound,
  }
}

async function latestReportTradelines(applicationUuid: string): Promise<Tradeline[]> {
  const sessions = await listDisputeSessionsForApplication(applicationUuid)
  for (const session of sessions) {
    const tradelines = session.report_json?.tradelines
    if (Array.isArray(tradelines) && tradelines.length) return tradelines
  }
  return []
}

/** Insert remaining negatives/inquiries as pending so they get a status dropdown. */
export async function ensurePendingItemsFromTradelines(params: {
  caseId: string
  tradelines: Tradeline[]
}): Promise<{ inserted: number; error?: string }> {
  const identities = pendingIdentitiesFromTradelines(params.tradelines)
  if (!identities.length) return { inserted: 0 }

  const existing = await listItemsForCase(params.caseId)
  const existingKeys = new Set(existing.map((item) => item.match_key))
  const now = new Date().toISOString()
  const rows = identities
    .filter((identity) => !existingKeys.has(identity.matchKey))
    .map((identity) => ({
      case_id: params.caseId,
      match_key: identity.matchKey,
      creditor_name: identity.creditorName,
      account_last4: identity.accountLast4,
      bureau: identity.bureau,
      account_type: identity.accountType,
      current_status: 'pending' satisfies DisputeItemStatus,
      last_round_number: null,
      last_letter_type: null,
      created_at: now,
      updated_at: now,
    }))

  if (!rows.length) return { inserted: 0 }

  const { error } = await getSupabase().from('dispute_items').insert(rows)
  if (error) {
    if (isMissingRelation(error)) return { inserted: 0 }
    // Parallel page loads can race the unique (case_id, match_key) insert.
    if (error.code === '23505') return { inserted: 0 }
    console.error('ensurePendingItemsFromTradelines error:', error)
    return { inserted: 0, error: error.message }
  }
  return { inserted: rows.length }
}

async function seedPendingItemsFromLatestReport(
  applicationUuid: string,
  caseId: string
): Promise<void> {
  const tradelines = await latestReportTradelines(applicationUuid)
  if (!tradelines.length) return
  await ensurePendingItemsFromTradelines({ caseId, tradelines })
}

export async function openOrCreateRound(params: {
  caseId: string
  sessionId: string
  forceNewRound?: boolean
}): Promise<{ round: DisputeRoundRow; created: boolean } | { error: string }> {
  const rounds = await listRoundsForCase(params.caseId)
  const draft = [...rounds]
    .reverse()
    .find((r) => r.status === 'draft' || r.status === 'letters_ready')
  if (draft && !params.forceNewRound) {
    const { data, error } = await getSupabase()
      .from('dispute_rounds')
      .update({
        session_id: params.sessionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft.id)
      .select('*')
      .single()
    if (error) return { error: error.message }
    return { round: data as DisputeRoundRow, created: false }
  }

  const latest = rounds[rounds.length - 1]
  if (latest && !isRoundClosedForNext(latest.status) && !params.forceNewRound) {
    return {
      error: `Round ${latest.round_number} is still ${latest.status}. Mark it mailed/closed before starting the next round (or force).`,
    }
  }

  const roundNumber = nextRoundNumber(rounds)
  const now = new Date().toISOString()
  const { data, error } = await getSupabase()
    .from('dispute_rounds')
    .insert({
      case_id: params.caseId,
      round_number: roundNumber,
      status: 'draft',
      session_id: params.sessionId,
      started_at: now,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  return { round: data as DisputeRoundRow, created: true }
}

export async function upsertRoundItemsFromTradelines(params: {
  caseId: string
  roundId: string
  roundNumber: number
  tradelines: Tradeline[]
}): Promise<{ itemIds: string[]; error?: string }> {
  const selections = expandTradelineSelections(params.tradelines)
  const db = getSupabase()
  const now = new Date().toISOString()
  const itemIds: string[] = []

  await db.from('dispute_round_items').delete().eq('round_id', params.roundId)

  for (const sel of selections) {
    for (const bureau of sel.bureaus) {
      const identity = itemIdentityFromTradeline(sel.tradeline, bureau)
      if (!identity) continue

      const { data: existing } = await db
        .from('dispute_items')
        .select('*')
        .eq('case_id', params.caseId)
        .eq('match_key', identity.matchKey)
        .maybeSingle()

      let itemId = (existing as DisputeItemRow | null)?.id
      if (itemId) {
        await db
          .from('dispute_items')
          .update({
            creditor_name: identity.creditorName,
            account_last4: identity.accountLast4,
            account_type: identity.accountType,
            current_status: 'selected_for_round' satisfies DisputeItemStatus,
            last_round_number: params.roundNumber,
            last_letter_type: 'bureau',
            updated_at: now,
          })
          .eq('id', itemId)
      } else {
        const { data: created, error } = await db
          .from('dispute_items')
          .insert({
            case_id: params.caseId,
            match_key: identity.matchKey,
            creditor_name: identity.creditorName,
            account_last4: identity.accountLast4,
            bureau: identity.bureau,
            account_type: identity.accountType,
            current_status: 'selected_for_round',
            last_round_number: params.roundNumber,
            last_letter_type: 'bureau',
            created_at: now,
            updated_at: now,
          })
          .select('id')
          .single()
        if (error || !created) {
          return { itemIds, error: error?.message || 'Failed to create dispute item' }
        }
        itemId = created.id as string
      }

      itemIds.push(itemId)
      const reason =
        sel.tradeline.dispute_reason?.trim() ||
        sel.tradeline.suggested_dispute_reason?.trim() ||
        ''
      await db.from('dispute_round_items').upsert(
        {
          round_id: params.roundId,
          item_id: itemId,
          dispute_reason: reason,
          letter_type: 'bureau',
          created_at: now,
        },
        { onConflict: 'round_id,item_id' }
      )
    }
  }

  return { itemIds }
}

export async function markRoundLettersReady(roundId: string, sessionId: string): Promise<void> {
  const now = new Date().toISOString()
  await getSupabase()
    .from('dispute_rounds')
    .update({
      status: 'letters_ready' satisfies DisputeRoundStatus,
      session_id: sessionId,
      updated_at: now,
    })
    .eq('id', roundId)

  await getSupabase()
    .from('dispute_sessions')
    .update({ round_id: roundId, updated_at: now })
    .eq('id', sessionId)

  const { data: links } = await getSupabase()
    .from('dispute_round_items')
    .select('item_id')
    .eq('round_id', roundId)
  const ids = (links || []).map((r) => r.item_id as string)
  if (ids.length) {
    await getSupabase()
      .from('dispute_items')
      .update({ current_status: 'disputed', updated_at: now })
      .in('id', ids)
  }
}

export async function updateRoundStatus(
  roundId: string,
  status: DisputeRoundStatus,
  mailedAt?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'mailed') {
    payload.mailed_at = mailedAt || new Date().toISOString()
  }
  const { error } = await getSupabase().from('dispute_rounds').update(payload).eq('id', roundId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function updateDisputeItemStatus(
  itemId: string,
  status: DisputeItemStatus,
  notes?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payload: Record<string, unknown> = {
    current_status: status,
    updated_at: new Date().toISOString(),
  }
  if (notes !== undefined) payload.notes = notes
  const { error } = await getSupabase().from('dispute_items').update(payload).eq('id', itemId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function getRoundNumberForSession(sessionId: string): Promise<number | null> {
  const { data: session, error } = await getSupabase()
    .from('dispute_sessions')
    .select('round_id')
    .eq('id', sessionId)
    .maybeSingle()
  if (error || !session?.round_id) return null

  const { data: round } = await getSupabase()
    .from('dispute_rounds')
    .select('round_number')
    .eq('id', session.round_id)
    .maybeSingle()
  return typeof round?.round_number === 'number' ? round.round_number : null
}

/**
 * Sync lifecycle when a letter plan is built for a session.
 * Enforces Round 1 caps; links session → round; upserts durable items.
 */
export async function syncLifecycleOnPlan(params: {
  sessionId: string
  applicationUuid: string | null | undefined
  tradelines: Tradeline[]
  forceNewRound?: boolean
}): Promise<
  | { ok: true; roundNumber: number; roundId: string; skipped?: boolean }
  | { ok: false; error: string; status: number }
> {
  const {
    enforceRound1BureauCaps,
    expandTradelineSelections,
  } = await import('@/lib/dispute-letters/dispute-lifecycle')

  const disputeCase = await getOrCreateDisputeCase(params.applicationUuid)
  if (!disputeCase) {
    // Tables not migrated yet — do not block letter generation
    return { ok: true, roundNumber: 1, roundId: '', skipped: true }
  }

  const rounds = await listRoundsForCase(disputeCase.id)
  const active =
    [...rounds].reverse().find((r) => r.status === 'draft' || r.status === 'letters_ready') || null
  const roundNumber = active?.round_number || nextRoundNumber(rounds) || 1

  if (roundNumber === 1) {
    const cap = enforceRound1BureauCaps(expandTradelineSelections(params.tradelines))
    if (!cap.ok) {
      return { ok: false, error: cap.message || 'Round 1 selection exceeds bureau caps', status: 400 }
    }
  }

  const opened = await openOrCreateRound({
    caseId: disputeCase.id,
    sessionId: params.sessionId,
    forceNewRound: params.forceNewRound,
  })
  if ('error' in opened) {
    return { ok: false, error: opened.error, status: 409 }
  }

  const upsert = await upsertRoundItemsFromTradelines({
    caseId: disputeCase.id,
    roundId: opened.round.id,
    roundNumber: opened.round.round_number,
    tradelines: params.tradelines,
  })
  if (upsert.error) {
    return { ok: false, error: upsert.error, status: 500 }
  }

  await ensurePendingItemsFromTradelines({
    caseId: disputeCase.id,
    tradelines: params.tradelines,
  })
  await markRoundLettersReady(opened.round.id, params.sessionId)

  return {
    ok: true,
    roundNumber: opened.round.round_number,
    roundId: opened.round.id,
  }
}

export async function updateRoundMailTracking(params: {
  roundId: string
  mailMethod?: DisputeMailMethod | null
  trackingNumber?: string | null
  deliveredAt?: string | null
  mailedAt?: string | null
  packetChecklist?: DisputePacketChecklist | null
  status?: DisputeRoundStatus | null
}): Promise<{ ok: true; deadlineAt: string | null } | { ok: false; error: string }> {
  const now = new Date().toISOString()
  const mailedAt = params.mailedAt || (params.status === 'mailed' ? now : null)
  const deadlineAt = computeDeadlineAt({
    deliveredAt: params.deliveredAt,
    mailedAt: mailedAt || undefined,
  })

  const payload: Record<string, unknown> = {
    updated_at: now,
    deadline_at: deadlineAt,
  }
  if (params.mailMethod !== undefined) payload.mail_method = params.mailMethod
  if (params.trackingNumber !== undefined) payload.tracking_number = params.trackingNumber
  if (params.deliveredAt !== undefined) payload.delivered_at = params.deliveredAt
  if (params.packetChecklist !== undefined) payload.packet_checklist = params.packetChecklist || {}
  if (mailedAt) payload.mailed_at = mailedAt
  if (params.status) payload.status = params.status
  else if (mailedAt) payload.status = 'mailed' satisfies DisputeRoundStatus
  else if (params.deliveredAt) payload.status = 'awaiting_response' satisfies DisputeRoundStatus

  const { error } = await getSupabase().from('dispute_rounds').update(payload).eq('id', params.roundId)
  if (error) {
    if (isMissingRelation(error)) return { ok: false, error: 'Run migration 035 for mail tracking fields.' }
    return { ok: false, error: error.message }
  }
  return { ok: true, deadlineAt }
}

export async function releaseRoundToClient(
  roundId: string,
  released = true
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await getSupabase()
    .from('dispute_rounds')
    .update({
      client_released_at: released ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roundId)
  if (error) {
    if (isMissingRelation(error)) return { ok: false, error: 'Run migration 035 for client release.' }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function listResponsesForRound(roundId: string): Promise<DisputeResponseRow[]> {
  const { data, error } = await getSupabase()
    .from('dispute_responses')
    .select('*')
    .eq('round_id', roundId)
    .order('created_at', { ascending: false })
  if (error) {
    if (!isMissingRelation(error)) console.error('listResponsesForRound error:', error)
    return []
  }
  return (data || []) as DisputeResponseRow[]
}

export async function createDisputeResponse(params: {
  roundId: string
  itemId?: string | null
  source: DisputeResponseSource
  fileName: string
  storagePath: string
  notes?: string | null
  uploadedBy?: string | null
}): Promise<{ ok: true; row: DisputeResponseRow } | { ok: false; error: string }> {
  const { data, error } = await getSupabase()
    .from('dispute_responses')
    .insert({
      round_id: params.roundId,
      item_id: params.itemId || null,
      source: params.source,
      file_name: params.fileName,
      storage_path: params.storagePath,
      notes: params.notes || null,
      uploaded_by: params.uploadedBy || null,
    })
    .select('*')
    .single()
  if (error || !data) {
    if (error && isMissingRelation(error)) {
      return { ok: false, error: 'Run migration 035 for dispute_responses.' }
    }
    return { ok: false, error: error?.message || 'Failed to save response' }
  }
  return { ok: true, row: data as DisputeResponseRow }
}

export async function listCfpbEscalationsForCase(caseId: string): Promise<DisputeCfpbEscalationRow[]> {
  const { data, error } = await getSupabase()
    .from('dispute_cfpb_escalations')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
  if (error) {
    if (!isMissingRelation(error)) console.error('listCfpbEscalationsForCase error:', error)
    return []
  }
  return (data || []).map((row) => ({
    ...(row as DisputeCfpbEscalationRow),
    item_ids: (row.item_ids as string[]) || [],
    complaint_markdown: (row.complaint_markdown as string) || '',
  }))
}

export async function upsertCfpbEscalation(params: {
  id?: string
  caseId: string
  itemIds: string[]
  complaintMarkdown: string
  status?: DisputeCfpbStatus
  notes?: string | null
  submittedAt?: string | null
  agencyResponseAt?: string | null
}): Promise<{ ok: true; row: DisputeCfpbEscalationRow } | { ok: false; error: string }> {
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    case_id: params.caseId,
    item_ids: params.itemIds,
    complaint_markdown: params.complaintMarkdown,
    status: params.status || 'draft',
    notes: params.notes ?? null,
    updated_at: now,
  }
  if (params.submittedAt !== undefined) payload.submitted_at = params.submittedAt
  if (params.agencyResponseAt !== undefined) payload.agency_response_at = params.agencyResponseAt

  if (params.id) {
    const { data, error } = await getSupabase()
      .from('dispute_cfpb_escalations')
      .update(payload)
      .eq('id', params.id)
      .select('*')
      .single()
    if (error || !data) return { ok: false, error: error?.message || 'Failed to update CFPB draft' }
    return {
      ok: true,
      row: {
        ...(data as DisputeCfpbEscalationRow),
        item_ids: (data.item_ids as string[]) || [],
      },
    }
  }

  const { data, error } = await getSupabase()
    .from('dispute_cfpb_escalations')
    .insert({ ...payload, created_at: now })
    .select('*')
    .single()
  if (error || !data) {
    if (error && isMissingRelation(error)) {
      return { ok: false, error: 'Run migration 035 for dispute_cfpb_escalations.' }
    }
    return { ok: false, error: error?.message || 'Failed to create CFPB draft' }
  }
  return {
    ok: true,
    row: {
      ...(data as DisputeCfpbEscalationRow),
      item_ids: (data.item_ids as string[]) || [],
    },
  }
}

export async function loadReleasedRoundsForApplication(
  applicationUuid: string
): Promise<{ rounds: DisputeRoundRow[]; items: DisputeItemRow[]; responses: DisputeResponseRow[] }> {
  const empty = { rounds: [] as DisputeRoundRow[], items: [] as DisputeItemRow[], responses: [] as DisputeResponseRow[] }
  const { data: caseRow, error } = await getSupabase()
    .from('dispute_cases')
    .select('id')
    .eq('application_uuid', applicationUuid)
    .maybeSingle()
  if (error || !caseRow) {
    if (error && !isMissingRelation(error)) console.error('loadReleasedRoundsForApplication error:', error)
    return empty
  }

  const { data: rounds, error: roundsErr } = await getSupabase()
    .from('dispute_rounds')
    .select('*')
    .eq('case_id', caseRow.id)
    .not('client_released_at', 'is', null)
    .order('round_number', { ascending: true })
  if (roundsErr) {
    if (!isMissingRelation(roundsErr)) console.error('released rounds error:', roundsErr)
    return empty
  }

  const roundRows = (rounds || []) as DisputeRoundRow[]
  const items = await listItemsForCase(caseRow.id as string)
  const responses: DisputeResponseRow[] = []
  for (const round of roundRows) {
    responses.push(...(await listResponsesForRound(round.id)))
  }
  return { rounds: roundRows, items, responses }
}
