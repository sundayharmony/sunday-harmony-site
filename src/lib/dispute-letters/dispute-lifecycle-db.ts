import { getSupabase } from '@/lib/supabase'
import { currentLetters } from '@/lib/dispute-letters/current-letters'
import {
  appendStatusEvent,
  buildLetterPackageSnapshot,
  comparisonUpdatesForItems,
  computeDeadlineAt,
  expandTradelineSelections,
  findItemForIdentity,
  findTrackedAccountItem,
  groupItemsByAccountNumber,
  uniqueItemsByAccountNumber,
  uniqueNextRoundItems,
  isRoundClosedForNext,
  isRoundFullySent,
  itemIdentityFromTradeline,
  type ItemIdentity,
  nextRoundNumber,
  notYetDisputedFromItems,
  pendingIdentitiesFromTradelines,
  preferDuplicateAccountItem,
  hasUpdatedReportForNextRound,
  pickSessionForLifecycleRecovery,
  roundWorkflowView,
  shouldReuseLetterPackage,
  splitWorkflowQueues,
  type DisputeRoundLetter,
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
  type LetterPackageMember,
  type LetterPackageRow,
  type LetterPackageSnapshot,
} from '@/lib/dispute-letters/dispute-lifecycle'
import {
  deleteDisputeSession,
  getDisputeSessionById,
  listDisputeSessionsForApplication,
} from '@/lib/dispute-letters/db'
import { removeDisputeSessionStorage } from '@/lib/dispute-letters-storage'
import {
  comparisonKeysFromSessions,
  DEFAULT_ROUND1_REPORT_DATE,
  followUpResponseNote,
  followUpSessionsAfterRound1,
  latestPendingIdentitiesFromSessions,
  pickHistoricalRound1Session,
  selectTradelinesForHistoricalRound1,
  type HistoricalPlan,
} from '@/lib/dispute-letters/round1-backfill'
import type { Tradeline } from '@/lib/dispute-letters/types'
import { accountMatchTokens, accountMatchTokensOverlap } from '@/lib/dispute-letters/tradeline-progress'

function emptyWorkflow() {
  return roundWorkflowView({ selectedCount: 0, generatedCount: 0, downloaded: false, sentCount: 0 })
}

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

function isMissingColumn(error: { message?: string; code?: string } | null, column: string): boolean {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  const col = column.toLowerCase()
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (msg.includes(col) && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find')))
  )
}

function identifiedHistory(now: string) {
  return [{ at: now, stage: 'identified' as const }]
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

async function findCaseByApplicationUuid(applicationUuid: string): Promise<DisputeCaseRow | null> {
  const { data, error } = await getSupabase()
    .from('dispute_cases')
    .select('*')
    .eq('application_uuid', applicationUuid)
    .maybeSingle()
  if (error) {
    if (!isMissingRelation(error)) console.error('findCaseByApplicationUuid error:', error)
    return null
  }
  return (data as DisputeCaseRow) || null
}

async function linkCaseToApplication(caseId: string, applicationUuid?: string | null): Promise<void> {
  const uuid = (applicationUuid || '').trim()
  if (!uuid) return
  const db = getSupabase()
  const { data } = await db.from('dispute_cases').select('application_uuid').eq('id', caseId).maybeSingle()
  if (!data || data.application_uuid) return
  await db
    .from('dispute_cases')
    .update({ application_uuid: uuid, updated_at: new Date().toISOString() })
    .eq('id', caseId)
}

async function attachSessionToRound(sessionId: string, roundId: string): Promise<void> {
  await getSupabase()
    .from('dispute_sessions')
    .update({ round_id: roundId, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
}

async function sessionLifecycleEvidence(
  sessionId: string
): Promise<'letters' | 'plans' | null> {
  const letters = currentLetters(await listRoundLetters(sessionId))
  if (letters.length) return 'letters'
  const plans = await loadSessionPlans(sessionId)
  return plans.length ? 'plans' : null
}

/**
 * Create or reuse the dispute case/round for a letter session so generate and
 * ZIP download are still visible after leaving Credit & Funding.
 */
export async function ensureLifecycleFromSession(
  sessionId: string,
  options?: { applicationUuid?: string | null }
): Promise<DisputeRoundRow | null> {
  const existing = await findRoundForSession(sessionId)
  if (existing) {
    await linkCaseToApplication(existing.case_id, options?.applicationUuid)
    await attachSessionToRound(sessionId, existing.id)
    return existing
  }

  const session = await getDisputeSessionById(sessionId)
  if (!session) return null

  let applicationUuid = (options?.applicationUuid || session.application_uuid || '').trim() || null
  if (!applicationUuid) {
    const name = session.report_json?.consumer?.name || session.file_name
    if (name) applicationUuid = await findApplicationUuidByConsumerName(name)
  }
  if (applicationUuid && !session.application_uuid) {
    await getSupabase()
      .from('dispute_sessions')
      .update({ application_uuid: applicationUuid, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
  }
  if (!applicationUuid) return null

  const linked = await findCaseByApplicationUuid(applicationUuid)
  if (!linked) {
    const siblings = await listDisputeSessionsForApplication(applicationUuid)
    for (const sibling of siblings) {
      const round = await findRoundForSession(sibling.id)
      if (!round) continue
      await linkCaseToApplication(round.case_id, applicationUuid)
      break
    }
  }

  const disputeCase = (await findCaseByApplicationUuid(applicationUuid)) || (await getOrCreateDisputeCase(applicationUuid))
  if (!disputeCase) return null

  const opened = await openOrCreateRound({
    caseId: disputeCase.id,
    sessionId,
  })
  if ('error' in opened) return null
  await attachSessionToRound(sessionId, opened.round.id)

  const tradelines = session.report_json?.tradelines || []
  const plans = await loadSessionPlans(sessionId)
  const selected = selectTradelinesForHistoricalRound1(tradelines, plans)
  await upsertRoundItemsFromTradelines({
    caseId: disputeCase.id,
    roundId: opened.round.id,
    roundNumber: opened.round.round_number,
    tradelines: selected,
  })
  await ensurePendingItemsFromTradelines({
    caseId: disputeCase.id,
    tradelines,
  })
  return opened.round
}

/**
 * Rebuild a missing case/round from stored letters or plans so returning to a
 * client still shows the generated package.
 */
export async function recoverLifecycleForApplication(applicationUuid: string): Promise<boolean> {
  const uuid = applicationUuid.trim()
  if (!uuid) return false

  const sessions = await listDisputeSessionsForApplication(uuid)
  const evidence = new Map<string, 'letters' | 'plans'>()
  for (const session of sessions) {
    const kind = await sessionLifecycleEvidence(session.id)
    if (kind) evidence.set(session.id, kind)
    const round = await findRoundForSession(session.id)
    if (round) await linkCaseToApplication(round.case_id, uuid)
  }

  const existingCase = await findCaseByApplicationUuid(uuid)
  const picked = pickSessionForLifecycleRecovery(sessions, evidence)
  if (!picked) return Boolean(existingCase)

  const packages = existingCase ? await listPackagesForCase(existingCase.id) : []
  const needsGenerateStamp = evidence.get(picked.id) === 'letters' && !packages.length

  const round = await ensureLifecycleFromSession(picked.id, { applicationUuid: uuid })
  if (!round) return Boolean(existingCase)
  if (needsGenerateStamp) {
    await onLettersGenerated(picked.id)
  }
  return true
}

export async function loadDisputeLifecycleForApplication(
  applicationUuid: string
): Promise<DisputeLifecycleSnapshot> {
  const empty: DisputeLifecycleSnapshot = {
    case: null,
    rounds: [],
    items: [],
    identifiedQueue: [],
    selectedQueue: [],
    letterGeneratedQueue: [],
    sentQueue: [],
    nextRoundQueue: [],
    notYetDisputed: [],
    pendingQueue: [],
    activeRound: null,
    letters: [],
    packages: [],
    activePackage: null,
    roundWorkflow: emptyWorkflow(),
    roundSendProgress: { selected: 0, sent: 0, complete: false },
    hasCompletedRound: false,
    hasUpdatedReportForNextRound: false,
  }

  try {
    await recoverLifecycleForApplication(applicationUuid)
  } catch (err) {
    console.error('recoverLifecycleForApplication error:', err)
  }
  const caseRow = await findCaseByApplicationUuid(applicationUuid)
  if (!caseRow) return empty

  const disputeCase = caseRow
  await collapseDuplicateAccountItems(disputeCase.id)
  await seedPendingItemsFromLatestReport(applicationUuid, disputeCase.id)
  await collapseDuplicateAccountItems(disputeCase.id)
  await repairUnsentDisputedItems(disputeCase.id)
  await applyComparisonFromLatestReport(applicationUuid, disputeCase.id)
  const rounds = await listRoundsForCase(disputeCase.id)
  const items = uniqueItemsByAccountNumber(await listItemsForCase(disputeCase.id))
  const activeRound =
    [...rounds].reverse().find((r) => r.status === 'draft' || r.status === 'letters_ready') ||
    rounds[rounds.length - 1] ||
    null

  const { data: links } = activeRound
    ? await getSupabase().from('dispute_round_items').select('item_id').eq('round_id', activeRound.id)
    : { data: [] as { item_id: string }[] }
  const roundItemIds = (links || []).map((r) => r.item_id as string)
  const complete = isRoundFullySent({ round: activeRound, roundItemIds, items })
  const completedRoundNumbers = rounds
    .filter(
      (r) =>
        r.status === 'mailed' ||
        r.status === 'closed' ||
        r.status === 'awaiting_response' ||
        (activeRound?.id === r.id && complete)
    )
    .map((r) => r.round_number)

  const queues = splitWorkflowQueues(items, activeRound, completedRoundNumbers)
  const completedRounds = rounds.filter((round) => completedRoundNumbers.includes(round.round_number))
  const responses: DisputeResponseRow[] = []
  for (const round of completedRounds) {
    responses.push(...(await listResponsesForRound(round.id)))
  }
  const sessions = await listDisputeSessionsForApplication(applicationUuid)
  const updatedReportReady = hasUpdatedReportForNextRound({
    sessions,
    completedRounds,
    responses,
  })
  const nextRoundQueue = updatedReportReady ? uniqueNextRoundItems(queues.nextRound) : []
  const letters = currentLetters(await listRoundLetters(activeRound?.session_id || null))
  const sentCount = roundItemIds.filter((id) => items.find((i) => i.id === id)?.sent_at).length
  const packages = await loadPackageSnapshotsForCase(disputeCase.id, items, rounds)
  const activePackage =
    packages.find((pkg) => pkg.package.round_id === activeRound?.id && pkg.package.is_active) ||
    packages.find((pkg) => pkg.package.is_active) ||
    null
  const roundWorkflow = roundWorkflowView({
    selectedCount: roundItemIds.length,
    generatedCount: activePackage?.generatedCount || letters.length,
    downloaded: Boolean(activePackage?.downloaded),
    sentCount,
  })

  return {
    case: disputeCase,
    rounds,
    items,
    identifiedQueue: queues.identified,
    selectedQueue: queues.selected,
    letterGeneratedQueue: queues.letterGenerated,
    sentQueue: queues.sent,
    nextRoundQueue,
    notYetDisputed: notYetDisputedFromItems(items),
    pendingQueue: nextRoundQueue,
    activeRound,
    letters,
    packages,
    activePackage,
    roundWorkflow,
    roundSendProgress: {
      selected: roundItemIds.length,
      sent: sentCount,
      complete,
    },
    hasCompletedRound: completedRoundNumbers.length > 0,
    hasUpdatedReportForNextRound: updatedReportReady,
  }
}

export async function loadLetterPackageForSession(sessionId: string): Promise<{
  round: DisputeRoundRow | null
  package: LetterPackageSnapshot | null
  letters: DisputeRoundLetter[]
}> {
  const round = await findRoundForSession(sessionId)
  const letters = currentLetters(await listRoundLetters(sessionId))
  if (!round) return { round: null, package: null, letters }
  const items = await listItemsForCase(round.case_id)
  const snapshots = await loadPackageSnapshotsForCase(round.case_id, items, [round])
  const active =
    snapshots.find((pkg) => pkg.package.round_id === round.id && pkg.package.is_active) ||
    snapshots[snapshots.length - 1] ||
    null
  return { round, package: active, letters }
}

async function collapseDuplicateAccountItems(caseId: string): Promise<void> {
  const items = await listItemsForCase(caseId)
  if (items.length < 2) return
  const db = getSupabase()
  const now = new Date().toISOString()

  for (const group of groupItemsByAccountNumber(items)) {
    if (group.length < 2) continue
    const keeper = group.reduce(preferDuplicateAccountItem)
    const canonicalLast4 = accountMatchTokens({
      bureau: keeper.bureau,
      accountLast4: keeper.account_last4,
      matchKey: keeper.match_key,
    })
      .find((token) => token.startsWith('a4:'))
      ?.slice(-4)
    const canonicalKey =
      canonicalLast4 && canonicalLast4.length === 4 ? `a4:${keeper.bureau}:${canonicalLast4}` : keeper.match_key

    for (const extra of group.filter((row) => row.id !== keeper.id)) {
      const { data: extraLinks } = await db
        .from('dispute_round_items')
        .select('round_id, item_id')
        .eq('item_id', extra.id)
      for (const link of extraLinks || []) {
        const { data: keeperLink } = await db
          .from('dispute_round_items')
          .select('item_id')
          .eq('round_id', link.round_id)
          .eq('item_id', keeper.id)
          .maybeSingle()
        if (keeperLink) {
          await db.from('dispute_round_items').delete().eq('round_id', link.round_id).eq('item_id', extra.id)
        } else {
          await db
            .from('dispute_round_items')
            .update({ item_id: keeper.id })
            .eq('round_id', link.round_id)
            .eq('item_id', extra.id)
        }
      }
      await db.from('dispute_items').delete().eq('id', extra.id)
    }

    if (canonicalKey !== keeper.match_key || (canonicalLast4 && keeper.account_last4 !== canonicalLast4)) {
      await db
        .from('dispute_items')
        .update({
          match_key: canonicalKey,
          account_last4: canonicalLast4 || keeper.account_last4,
          updated_at: now,
        })
        .eq('id', keeper.id)
    }
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

async function insertPendingIdentities(
  caseId: string,
  identities: ItemIdentity[]
): Promise<{ inserted: number; error?: string }> {
  if (!identities.length) return { inserted: 0 }

  const existing = await listItemsForCase(caseId)
  const now = new Date().toISOString()
  const rows: Array<{
    case_id: string
    match_key: string
    creditor_name: string
    account_last4: string
    bureau: ItemIdentity['bureau']
    account_type: string
    current_status: DisputeItemStatus
    last_round_number: null
    last_letter_type: null
    status_history: ReturnType<typeof identifiedHistory>
    created_at: string
    updated_at: string
  }> = []
  for (const identity of identities) {
    if (findTrackedAccountItem(existing, identity)) continue
    const row = {
      case_id: caseId,
      match_key: identity.matchKey,
      creditor_name: identity.creditorName,
      account_last4: identity.accountLast4,
      bureau: identity.bureau,
      account_type: identity.accountType,
      current_status: 'pending' as const satisfies DisputeItemStatus,
      last_round_number: null,
      last_letter_type: null,
      status_history: identifiedHistory(now),
      created_at: now,
      updated_at: now,
    }
    rows.push(row)
    existing.push({
      id: `pending-${rows.length}`,
      case_id: caseId,
      match_key: identity.matchKey,
      creditor_name: identity.creditorName,
      account_last4: identity.accountLast4,
      bureau: identity.bureau,
      account_type: identity.accountType,
      current_status: 'pending',
      last_round_number: null,
      last_letter_type: null,
      notes: null,
      created_at: now,
      updated_at: now,
      sent_at: null,
      status_history: row.status_history,
    })
  }

  if (!rows.length) return { inserted: 0 }

  const { error } = await getSupabase().from('dispute_items').insert(rows)
  if (error) {
    if (isMissingRelation(error)) return { inserted: 0 }
    if (isMissingColumn(error, 'status_history')) {
      const fallbackRows = rows.map(({ status_history: _h, ...rest }) => rest)
      const retry = await getSupabase().from('dispute_items').insert(fallbackRows)
      if (retry.error) {
        if (retry.error.code === '23505') return { inserted: 0 }
        console.error('ensurePendingItemsFromTradelines fallback error:', retry.error)
        return { inserted: 0, error: retry.error.message }
      }
      return { inserted: rows.length }
    }
    if (error.code === '23505') return { inserted: 0 }
    console.error('ensurePendingItemsFromTradelines error:', error)
    return { inserted: 0, error: error.message }
  }
  return { inserted: rows.length }
}

/** Insert remaining negatives/inquiries as pending so they appear in the identified queue. */
export async function ensurePendingItemsFromTradelines(params: {
  caseId: string
  tradelines: Tradeline[]
}): Promise<{ inserted: number; error?: string }> {
  return insertPendingIdentities(params.caseId, pendingIdentitiesFromTradelines(params.tradelines))
}

async function seedPendingItemsFromLatestReport(
  applicationUuid: string,
  caseId: string
): Promise<void> {
  const sessions = await listDisputeSessionsForApplication(applicationUuid)
  const identities = latestPendingIdentitiesFromSessions(sessions)
  if (identities.length) {
    await insertPendingIdentities(caseId, identities)
    return
  }
  const tradelines = await latestReportTradelines(applicationUuid)
  if (!tradelines.length) return
  await ensurePendingItemsFromTradelines({ caseId, tradelines })
}

/** Legacy plan-time stamps used status disputed without sent_at. That is not Sent. */
export async function repairUnsentDisputedItems(caseId: string): Promise<number> {
  const items = await listItemsForCase(caseId)
  const now = new Date().toISOString()
  const db = getSupabase()
  let repaired = 0
  for (const item of items) {
    if (item.current_status !== 'disputed' || item.sent_at) continue
    const history = (item.status_history || []).filter(
      (event) => event.stage !== 'still_appears' && event.stage !== 'sent'
    )
    const { error } = await db
      .from('dispute_items')
      .update({
        current_status: 'selected_for_round' satisfies DisputeItemStatus,
        status_history: appendStatusEvent(history, {
          at: now,
          stage: 'letter_generated',
          roundNumber: item.last_round_number,
          detail: 'Automatic Disputed stamp cleared; not sent until Confirm All Letters Sent',
        }),
        updated_at: now,
      })
      .eq('id', item.id)
    if (!error) repaired += 1
  }
  return repaired
}

export async function applyComparisonFromLatestReport(
  applicationUuid: string,
  caseId: string
): Promise<void> {
  const sessions = await listDisputeSessionsForApplication(applicationUuid)
  const { matchKeys: latestMatchKeys, candidateKeys: latestCandidateKeys } =
    comparisonKeysFromSessions(sessions)
  if (!latestMatchKeys.size && !latestCandidateKeys.size) return
  const items = await listItemsForCase(caseId)
  const updates = comparisonUpdatesForItems({ items, latestMatchKeys, latestCandidateKeys })
  if (!updates.length) return

  const db = getSupabase()
  const now = new Date().toISOString()
  const byId = new Map(items.map((item) => [item.id, item]))
  for (const update of updates) {
    const prev = byId.get(update.id)
    if (!prev) continue
    const payload: Record<string, unknown> = {
      updated_at: now,
      status_history: appendStatusEvent(prev.status_history, { at: now, ...update.event }),
    }
    if (update.nextStatus) payload.current_status = update.nextStatus
    const { error } = await db.from('dispute_items').update(payload).eq('id', update.id)
    if (error && (isMissingColumn(error, 'status_history') || isMissingRelation(error))) {
      if (update.nextStatus) {
        await db
          .from('dispute_items')
          .update({ current_status: update.nextStatus, updated_at: now })
          .eq('id', update.id)
      }
    }
  }
}

export async function listRoundLetters(sessionId: string | null): Promise<DisputeRoundLetter[]> {
  if (!sessionId) return []
  const db = getSupabase()
  const full = await db
    .from('dispute_letters')
    .select('id, session_id, plan_id, title, sent_at, created_at, package_id')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (full.error) {
    if (isMissingColumn(full.error, 'package_id')) {
      const withoutPkg = await db
        .from('dispute_letters')
        .select('id, session_id, plan_id, title, sent_at, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
      if (!withoutPkg.error && withoutPkg.data) {
        return (withoutPkg.data as DisputeRoundLetter[]).map((row) => ({
          ...row,
          package_id: null,
        }))
      }
    }
    if (isMissingColumn(full.error, 'sent_at')) {
      const basic = await db
        .from('dispute_letters')
        .select('id, session_id, plan_id, title, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
      if (basic.error) {
        if (!isMissingRelation(basic.error)) console.error('listRoundLetters error:', basic.error)
        return []
      }
      return ((basic.data || []) as Omit<DisputeRoundLetter, 'sent_at'>[]).map((row) => ({
        ...row,
        sent_at: null,
      }))
    }
    if (!isMissingRelation(full.error)) console.error('listRoundLetters error:', full.error)
    return []
  }
  return (full.data || []) as DisputeRoundLetter[]
}

type PlanItemJson = {
  tradeline_id?: string
  creditor?: string
  account_number?: string
  bureau?: string
}

type PlanJson = {
  id?: string
  letter_type?: string
  recipient_name?: string
  items?: PlanItemJson[]
}

function accountLast4FromRaw(raw: string | undefined): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length >= 4) return digits.slice(-4)
  return digits
}

function planItemBureaus(raw: string | undefined): string[] {
  return String(raw || '')
    .split(/[,\s]+/)
    .map((part) => part.trim().toUpperCase())
    .map((part) => (part === 'TU' ? 'TUC' : part))
    .filter((part) => part === 'TUC' || part === 'EXP' || part === 'EQF')
}

function matchPlanItemToDisputeItem(items: DisputeItemRow[], planItem: PlanItemJson): DisputeItemRow[] {
  const bureaus = planItemBureaus(planItem.bureau)
  const last4 = accountLast4FromRaw(planItem.account_number)
  return items.filter((item) => {
    if (bureaus.length && !bureaus.includes(item.bureau)) return false
    if (last4.length >= 4) {
      return accountMatchTokensOverlap(
        { bureau: item.bureau, accountLast4: item.account_last4, matchKey: item.match_key },
        { bureau: item.bureau, accountLast4: last4 }
      )
    }
    const creditor = (planItem.creditor || '').trim().toLowerCase()
    if (creditor && item.creditor_name.trim().toLowerCase() !== creditor) return false
    return true
  })
}

async function loadSessionPlans(sessionId: string): Promise<PlanJson[]> {
  const { data, error } = await getSupabase()
    .from('dispute_letter_plans')
    .select('plans_json')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error || !data) return []
  const raw = data.plans_json
  return Array.isArray(raw) ? (raw as PlanJson[]) : []
}

async function findRoundForSession(sessionId: string): Promise<DisputeRoundRow | null> {
  const db = getSupabase()
  const bySession = await db
    .from('dispute_rounds')
    .select('*')
    .eq('session_id', sessionId)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (bySession.data) return bySession.data as DisputeRoundRow
  const { data: session } = await db.from('dispute_sessions').select('round_id').eq('id', sessionId).maybeSingle()
  if (!session?.round_id) return null
  const { data: round } = await db.from('dispute_rounds').select('*').eq('id', session.round_id).maybeSingle()
  return (round as DisputeRoundRow) || null
}

async function listPackagesForCase(caseId: string): Promise<LetterPackageRow[]> {
  const { data, error } = await getSupabase()
    .from('dispute_letter_packages')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
  if (error) {
    if (!isMissingRelation(error)) console.error('listPackagesForCase error:', error)
    return []
  }
  return (data || []) as LetterPackageRow[]
}

async function listPackageItemRows(packageId: string): Promise<
  { package_id: string; item_id: string; letter_id: string | null; letter_type: string; sent_at: string | null }[]
> {
  const { data, error } = await getSupabase()
    .from('dispute_letter_package_items')
    .select('package_id, item_id, letter_id, letter_type, sent_at')
    .eq('package_id', packageId)
  if (error) {
    if (!isMissingRelation(error)) console.error('listPackageItemRows error:', error)
    return []
  }
  return (data || []) as {
    package_id: string
    item_id: string
    letter_id: string | null
    letter_type: string
    sent_at: string | null
  }[]
}

function hydratePackageMembers(
  rows: { package_id: string; item_id: string; letter_id: string | null; letter_type: string; sent_at: string | null }[],
  items: DisputeItemRow[],
  letters: DisputeRoundLetter[]
): LetterPackageMember[] {
  const byItem = new Map(items.map((item) => [item.id, item]))
  const byLetter = new Map(letters.map((letter) => [letter.id, letter]))
  return rows.map((row) => {
    const item = byItem.get(row.item_id)
    const letter = row.letter_id ? byLetter.get(row.letter_id) : undefined
    return {
      package_id: row.package_id,
      item_id: row.item_id,
      letter_id: row.letter_id,
      letter_type: row.letter_type || 'bureau',
      sent_at: row.sent_at,
      creditor_name: item?.creditor_name || 'Unknown',
      bureau: item?.bureau || 'TUC',
      account_last4: item?.account_last4 || '',
      letter_title: letter?.title || null,
    }
  })
}

async function loadPackageSnapshotsForCase(
  caseId: string,
  items: DisputeItemRow[],
  rounds: DisputeRoundRow[]
): Promise<LetterPackageSnapshot[]> {
  const packages = await listPackagesForCase(caseId)
  if (!packages.length) return []
  const lettersBySession = new Map<string, DisputeRoundLetter[]>()
  const snapshots: LetterPackageSnapshot[] = []
  for (const pkg of packages) {
    const sessionId = pkg.session_id || rounds.find((round) => round.id === pkg.round_id)?.session_id || null
    let letters: DisputeRoundLetter[] = []
    if (sessionId) {
      if (!lettersBySession.has(sessionId)) {
        lettersBySession.set(sessionId, await listRoundLetters(sessionId))
      }
      letters = lettersBySession.get(sessionId) || []
    }
    const rows = await listPackageItemRows(pkg.id)
    const members = hydratePackageMembers(rows, items, letters)
    const selectedCount = rows.length
    snapshots.push(
      buildLetterPackageSnapshot({
        package: pkg,
        members,
        selectedCount,
      })
    )
  }
  return snapshots
}

async function activePackageForRound(roundId: string): Promise<LetterPackageRow | null> {
  const { data, error } = await getSupabase()
    .from('dispute_letter_packages')
    .select('*')
    .eq('round_id', roundId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) {
    if (!isMissingRelation(error)) console.error('activePackageForRound error:', error)
    return null
  }
  return (data as LetterPackageRow) || null
}

async function replacePackageMembers(params: {
  packageId: string
  members: { itemId: string; letterId: string | null; letterType: string; sentAt: string | null }[]
}): Promise<void> {
  const db = getSupabase()
  await db.from('dispute_letter_package_items').delete().eq('package_id', params.packageId)
  if (!params.members.length) return
  const now = new Date().toISOString()
  const { error } = await db.from('dispute_letter_package_items').insert(
    params.members.map((member) => ({
      package_id: params.packageId,
      item_id: member.itemId,
      letter_id: member.letterId,
      letter_type: member.letterType,
      sent_at: member.sentAt,
      created_at: now,
    }))
  )
  if (error && !isMissingRelation(error)) console.error('replacePackageMembers error:', error)
}

async function collectPackageMembership(params: {
  roundId: string
  sessionId: string
  items: DisputeItemRow[]
}): Promise<{
  letters: DisputeRoundLetter[]
  members: { itemId: string; letterId: string | null; letterType: string; sentAt: string | null }[]
}> {
  const letters = currentLetters(await listRoundLetters(params.sessionId))
  const plans = await loadSessionPlans(params.sessionId)
  const planById = new Map(plans.map((plan) => [String(plan.id || ''), plan]))
  const { data: links } = await getSupabase()
    .from('dispute_round_items')
    .select('item_id, letter_id, letter_type, sent_at')
    .eq('round_id', params.roundId)
  const byItem = new Map(params.items.map((item) => [item.id, item]))
  const members: { itemId: string; letterId: string | null; letterType: string; sentAt: string | null }[] = []
  const seen = new Set<string>()

  for (const row of links || []) {
    const itemId = row.item_id as string
    if (!itemId || seen.has(itemId)) continue
    seen.add(itemId)
    const item = byItem.get(itemId)
    members.push({
      itemId,
      letterId: (row.letter_id as string | null) || null,
      letterType: (row.letter_type as string) || 'bureau',
      sentAt: (row.sent_at as string | null) || item?.sent_at || null,
    })
  }

  for (const letter of letters) {
    const plan = planById.get(letter.plan_id)
    for (const planItem of plan?.items || []) {
      for (const item of matchPlanItemToDisputeItem(params.items, planItem)) {
        const existing = members.find((member) => member.itemId === item.id)
        if (existing) {
          if (!existing.letterId) existing.letterId = letter.id
          continue
        }
        members.push({
          itemId: item.id,
          letterId: letter.id,
          letterType: plan?.letter_type || 'bureau',
          sentAt: item.sent_at || null,
        })
      }
    }
  }

  return { letters, members }
}

async function createLetterPackageVersion(params: {
  round: DisputeRoundRow
  sessionId: string
  letters: DisputeRoundLetter[]
  members: { itemId: string; letterId: string | null; letterType: string; sentAt: string | null }[]
  previous?: LetterPackageRow | null
}): Promise<LetterPackageRow | null> {
  const db = getSupabase()
  const now = new Date().toISOString()
  const version = (params.previous?.version || 0) + 1
  if (params.previous?.id) {
    await db
      .from('dispute_letter_packages')
      .update({ is_active: false, updated_at: now })
      .eq('id', params.previous.id)
  }

  const { data, error } = await db
    .from('dispute_letter_packages')
    .insert({
      case_id: params.round.case_id,
      round_id: params.round.id,
      session_id: params.sessionId,
      version,
      is_active: true,
      letter_count: params.letters.length,
      downloaded_at: null,
      download_count: 0,
      sent_confirmed_at: params.members.length && params.members.every((m) => m.sentAt) ? now : null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error || !data) {
    if (error && !isMissingRelation(error)) console.error('createLetterPackageVersion error:', error)
    return null
  }

  const created = data as LetterPackageRow
  await replacePackageMembers({ packageId: created.id, members: params.members })
  if (params.letters.length) {
    const ids = params.letters.map((letter) => letter.id)
    const stamped = await db
      .from('dispute_letters')
      .update({ package_id: created.id, letter_version: version })
      .in('id', ids)
    if (stamped.error && isMissingColumn(stamped.error, 'letter_version')) {
      await db.from('dispute_letters').update({ package_id: created.id }).in('id', ids)
    }
  }
  const roundUpdate = await db
    .from('dispute_rounds')
    .update({ active_package_id: created.id, updated_at: now })
    .eq('id', params.round.id)
  if (roundUpdate.error && !isMissingColumn(roundUpdate.error, 'active_package_id') && !isMissingRelation(roundUpdate.error)) {
    console.error('createLetterPackageVersion round update error:', roundUpdate.error)
  }
  return created
}

/** Create or reuse the active letter package after generation. Does not mark Sent. */
export async function upsertLetterPackageOnGenerate(params: {
  round: DisputeRoundRow
  sessionId: string
  items: DisputeItemRow[]
}): Promise<LetterPackageRow | null> {
  const { letters, members } = await collectPackageMembership({
    roundId: params.round.id,
    sessionId: params.sessionId,
    items: params.items,
  })
  if (!letters.length) return activePackageForRound(params.round.id)

  const existing = await activePackageForRound(params.round.id)
  const existingIds = existing
    ? (await listPackageItemRows(existing.id)).map((row) => row.letter_id).filter((id): id is string => Boolean(id))
    : []
  const newIds = letters.map((letter) => letter.id)

  if (existing && shouldReuseLetterPackage(existingIds, newIds)) {
    const now = new Date().toISOString()
    await replacePackageMembers({ packageId: existing.id, members })
    await getSupabase()
      .from('dispute_letter_packages')
      .update({
        letter_count: letters.length,
        session_id: params.sessionId,
        updated_at: now,
      })
      .eq('id', existing.id)
    return existing
  }

  return createLetterPackageVersion({
    round: params.round,
    sessionId: params.sessionId,
    letters,
    members,
    previous: existing,
  })
}

/** Record a ZIP download for the active package. Never marks items Sent or creates letters. */
export async function recordLetterPackageDownload(sessionId: string): Promise<LetterPackageRow | null> {
  const round = await ensureLifecycleFromSession(sessionId)
  if (!round) return null
  const items = await listItemsForCase(round.case_id)
  let pkg = await activePackageForRound(round.id)
  if (!pkg) {
    pkg = await upsertLetterPackageOnGenerate({ round, sessionId, items })
  }
  if (!pkg) return null

  const now = new Date().toISOString()
  const { data, error } = await getSupabase()
    .from('dispute_letter_packages')
    .update({
      downloaded_at: pkg.downloaded_at || now,
      download_count: (pkg.download_count || 0) + 1,
      updated_at: now,
    })
    .eq('id', pkg.id)
    .select('*')
    .single()
  if (error) {
    if (!isMissingRelation(error) && !isMissingColumn(error, 'download_count')) {
      console.error('recordLetterPackageDownload error:', error)
    }
    return pkg
  }
  return (data as LetterPackageRow) || pkg
}

async function stampRoundItemsSent(params: {
  round: DisputeRoundRow
  itemIds: string[]
  letterIdByItem: Map<string, string | null>
  items: DisputeItemRow[]
  now: string
}): Promise<void> {
  const db = getSupabase()
  for (const itemId of params.itemIds) {
    const prev = params.items.find((item) => item.id === itemId)
    if (prev?.sent_at && prev.last_round_number === params.round.round_number) continue
    const letterId = params.letterIdByItem.get(itemId) || null
    await db
      .from('dispute_items')
      .update({
        current_status: 'disputed' satisfies DisputeItemStatus,
        sent_at: params.now,
        status_history: appendStatusEvent(prev?.status_history, {
          at: params.now,
          stage: 'sent',
          roundNumber: params.round.round_number,
          detail: `Round ${params.round.round_number} letter sent`,
        }),
        updated_at: params.now,
      })
      .eq('id', itemId)
    const roundItemUpdate: Record<string, unknown> = { sent_at: params.now }
    if (letterId) roundItemUpdate.letter_id = letterId
    await db.from('dispute_round_items').update(roundItemUpdate).eq('round_id', params.round.id).eq('item_id', itemId)
    if (letterId) {
      await db.from('dispute_letters').update({ sent_at: params.now }).eq('id', letterId)
    }
  }
}

export async function confirmLetterPackageSent(
  packageId: string
): Promise<{ ok: true; sentAt: string; roundComplete: boolean; itemCount: number } | { ok: false; error: string }> {
  const db = getSupabase()
  const now = new Date().toISOString()
  const { data: pkg, error: pkgErr } = await db
    .from('dispute_letter_packages')
    .select('*')
    .eq('id', packageId)
    .maybeSingle()
  if (pkgErr || !pkg) {
    if (pkgErr && isMissingRelation(pkgErr)) {
      return { ok: false, error: 'Run migration 039 for letter packages.' }
    }
    return { ok: false, error: pkgErr?.message || 'Letter package not found' }
  }

  const packageRow = pkg as LetterPackageRow
  const { data: round } = await db.from('dispute_rounds').select('*').eq('id', packageRow.round_id).maybeSingle()
  if (!round) return { ok: false, error: 'Dispute round not found' }
  const roundRow = round as DisputeRoundRow
  const items = await listItemsForCase(roundRow.case_id)
  const rows = await listPackageItemRows(packageRow.id)
  if (!rows.length) return { ok: false, error: 'Letter package has no associated credit items' }

  const letterIdByItem = new Map(rows.map((row) => [row.item_id, row.letter_id]))
  await stampRoundItemsSent({
    round: roundRow,
    itemIds: rows.map((row) => row.item_id),
    letterIdByItem,
    items,
    now,
  })

  await db
    .from('dispute_letter_package_items')
    .update({ sent_at: now })
    .eq('package_id', packageRow.id)
    .is('sent_at', null)

  await db
    .from('dispute_letter_packages')
    .update({ sent_confirmed_at: packageRow.sent_confirmed_at || now, updated_at: now })
    .eq('id', packageRow.id)

  const roundComplete = await maybeCompleteRoundIfFullySent(roundRow.id)
  return { ok: true, sentAt: now, roundComplete, itemCount: rows.length }
}

export async function confirmAllLettersSentForSession(
  sessionId: string
): Promise<
  | { ok: true; sentAt: string; roundComplete: boolean; itemCount: number }
  | { ok: false; error: string }
> {
  const round = await ensureLifecycleFromSession(sessionId)
  if (!round) return { ok: false, error: 'No dispute round for this session' }
  let pkg = await activePackageForRound(round.id)
  if (!pkg) {
    const items = await listItemsForCase(round.case_id)
    pkg = await upsertLetterPackageOnGenerate({ round, sessionId, items })
  }
  if (pkg) return confirmLetterPackageSent(pkg.id)

  const letters = currentLetters(await listRoundLetters(sessionId)).filter((letter) => !letter.sent_at)
  if (!letters.length) return { ok: false, error: 'No generated letters to confirm' }
  let roundComplete = false
  let sentAt = new Date().toISOString()
  for (const letter of letters) {
    const result = await markLetterSent(letter.id)
    if (!result.ok) return result
    sentAt = result.sentAt
    roundComplete = result.roundComplete
  }
  return { ok: true, sentAt, roundComplete, itemCount: letters.length }
}

async function linkLettersToRoundItems(
  roundId: string,
  sessionId: string,
  items: DisputeItemRow[]
): Promise<void> {
  const letters = await listRoundLetters(sessionId)
  const plans = await loadSessionPlans(sessionId)
  const planById = new Map(plans.map((plan) => [String(plan.id || ''), plan]))
  const db = getSupabase()
  for (const letter of letters) {
    const plan = planById.get(letter.plan_id)
    for (const planItem of plan?.items || []) {
      for (const item of matchPlanItemToDisputeItem(items, planItem)) {
        const { error } = await db
          .from('dispute_round_items')
          .update({ letter_id: letter.id })
          .eq('round_id', roundId)
          .eq('item_id', item.id)
        if (error && (isMissingColumn(error, 'letter_id') || isMissingRelation(error))) return
      }
    }
  }
}

async function stampLetterGeneratedHistory(round: DisputeRoundRow, items: DisputeItemRow[]): Promise<void> {
  const now = new Date().toISOString()
  const { data: links } = await getSupabase()
    .from('dispute_round_items')
    .select('item_id')
    .eq('round_id', round.id)
  const ids = new Set((links || []).map((row) => row.item_id as string))
  const db = getSupabase()
  for (const item of items) {
    if (!ids.has(item.id)) continue
    if (item.current_status !== 'selected_for_round' && item.current_status !== 'disputed') continue
    const history = item.status_history || []
    if (history.some((event) => event.stage === 'letter_generated' && event.roundNumber === round.round_number)) {
      continue
    }
    await db
      .from('dispute_items')
      .update({
        status_history: appendStatusEvent(history, {
          at: now,
          stage: 'letter_generated',
          roundNumber: round.round_number,
          detail: `Round ${round.round_number} letter generated`,
        }),
        updated_at: now,
      })
      .eq('id', item.id)
  }
}

/** After Python finishes generating letters: round → letters_ready, items stay selected until Sent. */
export async function onLettersGenerated(sessionId: string): Promise<void> {
  const round = await ensureLifecycleFromSession(sessionId)
  if (!round) return
  await markRoundLettersReady(round.id, sessionId)
  const items = await listItemsForCase(round.case_id)
  await linkLettersToRoundItems(round.id, sessionId, items)
  await stampLetterGeneratedHistory(round, items)
  await upsertLetterPackageOnGenerate({ round, sessionId, items })
}

async function maybeCompleteRoundIfFullySent(roundId: string): Promise<boolean> {
  const db = getSupabase()
  const { data: round } = await db.from('dispute_rounds').select('*').eq('id', roundId).maybeSingle()
  if (!round) return false
  const { data: links } = await db
    .from('dispute_round_items')
    .select('item_id, sent_at')
    .eq('round_id', roundId)
  const itemIds = (links || []).map((row) => row.item_id as string)
  if (!itemIds.length) return false
  const items = await listItemsForCase(round.case_id as string)
  const complete = isRoundFullySent({
    round: round as DisputeRoundRow,
    roundItemIds: itemIds,
    items,
  })
  if (!complete) return false
  const latestSent =
    items
      .filter((item) => itemIds.includes(item.id) && item.sent_at)
      .map((item) => item.sent_at as string)
      .sort()
      .pop() || new Date().toISOString()
  await db
    .from('dispute_rounds')
    .update({
      status: 'awaiting_response' satisfies DisputeRoundStatus,
      mailed_at: (round as DisputeRoundRow).mailed_at || latestSent,
      deadline_at: computeDeadlineAt({ mailedAt: latestSent }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', roundId)
  return true
}

export async function markLetterSent(
  letterId: string
): Promise<{ ok: true; sentAt: string; roundComplete: boolean } | { ok: false; error: string }> {
  const db = getSupabase()
  const now = new Date().toISOString()
  const { data: letter, error: letterErr } = await db
    .from('dispute_letters')
    .select('id, session_id, plan_id, title, sent_at')
    .eq('id', letterId)
    .maybeSingle()
  if (letterErr || !letter) {
    return { ok: false, error: letterErr?.message || 'Letter not found' }
  }

  const sentUpdate = await db.from('dispute_letters').update({ sent_at: now }).eq('id', letterId)
  if (sentUpdate.error && !isMissingColumn(sentUpdate.error, 'sent_at')) {
    return { ok: false, error: sentUpdate.error.message }
  }

  const round = await findRoundForSession(String(letter.session_id))
  if (!round) return { ok: true, sentAt: now, roundComplete: false }

  const items = await listItemsForCase(round.case_id)
  await linkLettersToRoundItems(round.id, String(letter.session_id), items)

  const { data: links } = await db
    .from('dispute_round_items')
    .select('item_id, letter_id')
    .eq('round_id', round.id)

  let targetIds = (links || [])
    .filter((row) => row.letter_id === letterId)
    .map((row) => row.item_id as string)

  if (!targetIds.length) {
    const plans = await loadSessionPlans(String(letter.session_id))
    const plan = plans.find((p) => p.id === letter.plan_id)
    const matched = new Set<string>()
    for (const planItem of plan?.items || []) {
      for (const item of matchPlanItemToDisputeItem(items, planItem)) matched.add(item.id)
    }
    targetIds = [...matched]
  }

  for (const itemId of targetIds) {
    const prev = items.find((item) => item.id === itemId)
    await db
      .from('dispute_items')
      .update({
        current_status: 'disputed' satisfies DisputeItemStatus,
        sent_at: now,
        status_history: appendStatusEvent(prev?.status_history, {
          at: now,
          stage: 'sent',
          roundNumber: round.round_number,
          detail: `Round ${round.round_number} letter sent`,
        }),
        updated_at: now,
      })
      .eq('id', itemId)
    await db
      .from('dispute_round_items')
      .update({ sent_at: now, letter_id: letterId })
      .eq('round_id', round.id)
      .eq('item_id', itemId)
  }

  const activePkg = await activePackageForRound(round.id)
  if (activePkg && targetIds.length) {
    await db
      .from('dispute_letter_package_items')
      .update({ sent_at: now, letter_id: letterId })
      .eq('package_id', activePkg.id)
      .in('item_id', targetIds)
    const rows = await listPackageItemRows(activePkg.id)
    if (rows.length && rows.every((row) => row.sent_at || targetIds.includes(row.item_id))) {
      await db
        .from('dispute_letter_packages')
        .update({ sent_confirmed_at: activePkg.sent_confirmed_at || now, updated_at: now })
        .eq('id', activePkg.id)
    }
  }

  const roundComplete = await maybeCompleteRoundIfFullySent(round.id)
  return { ok: true, sentAt: now, roundComplete }
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
  const caseItems = await listItemsForCase(params.caseId)

  await db.from('dispute_round_items').delete().eq('round_id', params.roundId)

  for (const sel of selections) {
    for (const bureau of sel.bureaus) {
      const identity = itemIdentityFromTradeline(sel.tradeline, bureau)
      if (!identity) continue

      const existing = findItemForIdentity(caseItems, identity)

      let itemId = existing?.id
      if (itemId && existing) {
        const prev = existing
        const selectedEvent = {
          at: now,
          stage: 'selected' as const,
          roundNumber: params.roundNumber,
          detail: `Selected for Round ${params.roundNumber}`,
        }
        const history = appendStatusEvent(prev.status_history, selectedEvent)
        await db
          .from('dispute_items')
          .update({
            match_key: identity.matchKey,
            creditor_name: identity.creditorName,
            account_last4: identity.accountLast4,
            account_type: identity.accountType,
            current_status: 'selected_for_round' satisfies DisputeItemStatus,
            last_round_number: params.roundNumber,
            last_letter_type: 'bureau',
            status_history: history,
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
            status_history: [
              { at: now, stage: 'identified' },
              {
                at: now,
                stage: 'selected',
                roundNumber: params.roundNumber,
                detail: `Selected for Round ${params.roundNumber}`,
              },
            ],
            created_at: now,
            updated_at: now,
          })
          .select('id')
          .single()
        if (error || !created) {
          return { itemIds, error: error?.message || 'Failed to create dispute item' }
        }
        itemId = created.id as string
        caseItems.push({
          id: itemId,
          case_id: params.caseId,
          match_key: identity.matchKey,
          creditor_name: identity.creditorName,
          account_last4: identity.accountLast4,
          bureau: identity.bureau,
          account_type: identity.accountType,
          current_status: 'selected_for_round',
          last_round_number: params.roundNumber,
          last_letter_type: 'bureau',
          notes: null,
          created_at: now,
          updated_at: now,
        })
      }

      if (itemIds.includes(itemId)) continue
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

  const selected = new Set(itemIds)
  const existingItems = await listItemsForCase(params.caseId)
  for (const item of existingItems) {
    if (
      item.current_status === 'selected_for_round' &&
      item.last_round_number === params.roundNumber &&
      !selected.has(item.id)
    ) {
      await db
        .from('dispute_items')
        .update({
          current_status: 'pending' satisfies DisputeItemStatus,
          status_history: appendStatusEvent(item.status_history, {
            at: now,
            stage: 'identified',
            roundNumber: params.roundNumber,
            detail: `Unselected from Round ${params.roundNumber}`,
          }),
          updated_at: now,
        })
        .eq('id', item.id)
    }
  }

  return { itemIds }
}

/** Round has generated letters. Does not mark items disputed — Sent does that. */
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
  const db = getSupabase()
  const now = new Date().toISOString()
  const { data: existing } = await db.from('dispute_items').select('*').eq('id', itemId).maybeSingle()
  const prev = existing as DisputeItemRow | null
  const stage =
    status === 'pending'
      ? 'identified'
      : status === 'selected_for_round'
        ? 'selected'
        : status === 'disputed'
          ? 'letter_generated'
          : status === 'deleted'
            ? 'resolved'
            : status === 'withdrawn' || status === 'frivolous'
              ? 'withdrawn'
              : 'still_appears'
  const payload: Record<string, unknown> = {
    current_status: status,
    updated_at: now,
    status_history: appendStatusEvent(prev?.status_history, {
      at: now,
      stage,
      roundNumber: prev?.last_round_number,
      detail: notes || `Status set to ${status}`,
    }),
  }
  if (notes !== undefined) payload.notes = notes
  const { error } = await db.from('dispute_items').update(payload).eq('id', itemId)
  if (error) {
    if (isMissingColumn(error, 'status_history') || isMissingColumn(error, 'sent_at')) {
      const fallback: Record<string, unknown> = { current_status: status, updated_at: now }
      if (notes !== undefined) fallback.notes = notes
      const retry = await db.from('dispute_items').update(fallback).eq('id', itemId)
      if (retry.error) return { ok: false, error: retry.error.message }
      return { ok: true }
    }
    return { ok: false, error: error.message }
  }
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
 * Selected items become selected_for_round only. Letters generated and Sent
 * are separate later steps. Bureau letters split at 7 items — selection is not blocked.
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
  const disputeCase = await getOrCreateDisputeCase(params.applicationUuid)
  if (!disputeCase) {
    // Tables not migrated yet — do not block letter generation
    return { ok: true, roundNumber: 1, roundId: '', skipped: true }
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

export type HistoricalRound1BackfillSummary = {
  applicationUuid: string
  round1SessionId: string
  round1FileName: string
  roundId: string
  itemCount: number
  letterCount: number
  followUpCount: number
  responseCount: number
  alreadyComplete: boolean
}

export async function findApplicationUuidByConsumerName(name: string): Promise<string | null> {
  const needle = name.trim().replace(/[%_]/g, '')
  if (!needle) return null
  const db = getSupabase()
  const sessions = await db
    .from('dispute_sessions')
    .select('application_uuid, file_name')
    .ilike('file_name', `%${needle}%`)
    .not('application_uuid', 'is', null)
    .limit(20)
  const fromFile = (sessions.data || []).find((row) => row.application_uuid)
  if (fromFile?.application_uuid) return String(fromFile.application_uuid)

  const apps = await db.from('credit_funding_applications').select('id, full_name').ilike('full_name', `%${needle}%`).limit(10)
  const rows = apps.data || []
  if (rows.length === 1) return String(rows[0].id)
  const exact = rows.find((row) => String(row.full_name || '').trim().toLowerCase() === needle.toLowerCase())
  return exact ? String(exact.id) : rows[0] ? String(rows[0].id) : null
}

async function ensureRound1Row(params: {
  caseId: string
  sessionId: string
  startedAt: string
}): Promise<DisputeRoundRow | { error: string }> {
  const existing = (await listRoundsForCase(params.caseId)).find((round) => round.round_number === 1)
  const db = getSupabase()
  const now = new Date().toISOString()
  if (existing) {
    const { data, error } = await db
      .from('dispute_rounds')
      .update({
        session_id: params.sessionId,
        updated_at: now,
        notes:
          existing.notes ||
          'Backfilled: Round 1 was mailed from the original 3-bureau report. Later bureau uploads are recorded as responses.',
      })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error || !data) return { error: error?.message || 'Failed to update Round 1' }
    return data as DisputeRoundRow
  }
  const { data, error } = await db
    .from('dispute_rounds')
    .insert({
      case_id: params.caseId,
      round_number: 1,
      status: 'draft',
      session_id: params.sessionId,
      notes:
        'Backfilled: Round 1 was mailed from the original 3-bureau report. Later bureau uploads are recorded as responses.',
      started_at: params.startedAt,
      created_at: params.startedAt,
      updated_at: now,
    })
    .select('*')
    .single()
  if (error || !data) return { error: error?.message || 'Failed to create Round 1' }
  return data as DisputeRoundRow
}

async function attachFollowUpResponses(
  roundId: string,
  followUps: import('@/lib/dispute-letters/types').DisputeSessionListItem[]
): Promise<number> {
  const existing = await listResponsesForRound(roundId)
  const seen = new Set(
    existing.map((row) => `${row.storage_path}::${row.file_name}`.toLowerCase())
  )
  let created = 0
  for (const session of followUps) {
    const key = `${session.storage_path}::${session.file_name}`.toLowerCase()
    if (seen.has(key)) continue
    const result = await createDisputeResponse({
      roundId,
      source: 'bureau',
      fileName: session.file_name,
      storagePath: session.storage_path,
      notes: followUpResponseNote(session),
      uploadedBy: 'historical-backfill',
    })
    if (result.ok) {
      seen.add(key)
      created += 1
    }
  }
  return created
}

async function stampHistoricalRoundSent(params: {
  round: DisputeRoundRow
  sessionId: string
  mailedAt: string
}): Promise<{ letterCount: number; itemCount: number; error?: string }> {
  await markRoundLettersReady(params.round.id, params.sessionId)
  await onLettersGenerated(params.sessionId)
  const items = await listItemsForCase(params.round.case_id)
  const { data: links } = await getSupabase()
    .from('dispute_round_items')
    .select('item_id')
    .eq('round_id', params.round.id)
  const itemIds = (links || []).map((row) => row.item_id as string)
  const letters = currentLetters(await listRoundLetters(params.sessionId))
  if (letters.length) {
    const confirmed = await confirmAllLettersSentForSession(params.sessionId)
    if (!confirmed.ok) {
      await stampRoundItemsSent({
        round: params.round,
        itemIds,
        letterIdByItem: new Map(),
        items,
        now: params.mailedAt,
      })
      await maybeCompleteRoundIfFullySent(params.round.id)
    }
  } else {
    await stampRoundItemsSent({
      round: params.round,
      itemIds,
      letterIdByItem: new Map(),
      items,
      now: params.mailedAt,
    })
    await maybeCompleteRoundIfFullySent(params.round.id)
  }
  await updateRoundMailTracking({
    roundId: params.round.id,
    mailedAt: params.mailedAt,
    status: 'awaiting_response',
    packetChecklist: {
      letters_printed: true,
      photo_id: true,
      mail_proof: true,
    },
  })
  return { letterCount: letters.length, itemCount: itemIds.length }
}

export async function backfillHistoricalRound1ForApplication(params: {
  applicationUuid: string
  preferredReportDate?: string
}): Promise<{ ok: true; summary: HistoricalRound1BackfillSummary } | { ok: false; error: string }> {
  const applicationUuid = params.applicationUuid.trim()
  if (!applicationUuid) return { ok: false, error: 'applicationUuid is required' }

  const sessions = await listDisputeSessionsForApplication(applicationUuid)
  const round1Session = pickHistoricalRound1Session(sessions, params.preferredReportDate || DEFAULT_ROUND1_REPORT_DATE)
  if (!round1Session) {
    return { ok: false, error: 'No 3-bureau Round 1 report found for this client.' }
  }
  const tradelines = (round1Session.report_json?.tradelines || []) as Tradeline[]
  if (!tradelines.length) {
    return { ok: false, error: `Round 1 report ${round1Session.file_name} has no tradelines.` }
  }

  const followUps = followUpSessionsAfterRound1(sessions, round1Session)
  const disputeCase = await getOrCreateDisputeCase(applicationUuid)
  if (!disputeCase) return { ok: false, error: 'Could not create a dispute case. Confirm dispute round migrations are applied.' }

  const plans = (await loadSessionPlans(round1Session.id)) as HistoricalPlan[]
  const selected = selectTradelinesForHistoricalRound1(tradelines, plans)
  if (!selected.some((row) => row.selected)) {
    return { ok: false, error: 'Could not determine which accounts were in the original Round 1 letters.' }
  }

  const startedAt = round1Session.created_at || new Date().toISOString()
  const round = await ensureRound1Row({
    caseId: disputeCase.id,
    sessionId: round1Session.id,
    startedAt,
  })
  if ('error' in round) return { ok: false, error: round.error }

  const existingItems = await listItemsForCase(disputeCase.id)
  const { data: existingLinks } = await getSupabase()
    .from('dispute_round_items')
    .select('item_id, sent_at')
    .eq('round_id', round.id)
  const linkedIds = (existingLinks || []).map((row) => row.item_id as string)
  const alreadySent =
    linkedIds.length > 0 &&
    linkedIds.every((id) => existingItems.find((item) => item.id === id)?.sent_at || existingLinks?.find((row) => row.item_id === id)?.sent_at)

  let itemCount = linkedIds.length
  let letterCount = currentLetters(await listRoundLetters(round1Session.id)).length
  if (!alreadySent) {
    const upsert = await upsertRoundItemsFromTradelines({
      caseId: disputeCase.id,
      roundId: round.id,
      roundNumber: 1,
      tradelines: selected,
    })
    if (upsert.error) return { ok: false, error: upsert.error }
    const letters = await listRoundLetters(round1Session.id)
    const mailedAt = letters[0]?.created_at || round1Session.updated_at || startedAt
    const stamped = await stampHistoricalRoundSent({
      round,
      sessionId: round1Session.id,
      mailedAt,
    })
    if (stamped.error) return { ok: false, error: stamped.error }
    itemCount = stamped.itemCount
    letterCount = stamped.letterCount
  } else if (round.status === 'draft' || round.status === 'letters_ready' || round.status === 'mailed') {
    await updateRoundMailTracking({
      roundId: round.id,
      mailedAt: round.mailed_at || existingItems.find((item) => item.sent_at)?.sent_at || startedAt,
      status: 'awaiting_response',
    })
  }

  await attachFollowUpResponses(round.id, followUps)
  await applyComparisonFromLatestReport(applicationUuid, disputeCase.id)
  await seedPendingItemsFromLatestReport(applicationUuid, disputeCase.id)
  const responses = await listResponsesForRound(round.id)

  return {
    ok: true,
    summary: {
      applicationUuid,
      round1SessionId: round1Session.id,
      round1FileName: round1Session.file_name,
      roundId: round.id,
      itemCount,
      letterCount,
      followUpCount: followUps.length,
      responseCount: responses.length,
      alreadyComplete: alreadySent,
    },
  }
}

/**
 * Wipe reports, generated letters, rounds, and item history for an application
 * so staff can start over as if the first report was never uploaded.
 */
export async function resetDisputeWorkForApplication(applicationUuid: string): Promise<{
  ok: true
  sessionsDeleted: number
  caseDeleted: boolean
} | { ok: false; error: string }> {
  if (!applicationUuid.trim()) return { ok: false, error: 'applicationUuid is required' }

  const db = getSupabase()
  const { data: sessionRows, error: sessionErr } = await db
    .from('dispute_sessions')
    .select('id, storage_path')
    .eq('application_uuid', applicationUuid)
    .limit(100)

  if (sessionErr && !isMissingRelation(sessionErr)) {
    return { ok: false, error: sessionErr.message }
  }

  const sessions = sessionRows || []
  for (const row of sessions) {
    await removeDisputeSessionStorage(String(row.id), row.storage_path as string | null)
    const deleted = await deleteDisputeSession(String(row.id))
    if (!deleted.ok) return { ok: false, error: deleted.error }
  }

  const { data: caseRow, error: caseErr } = await db
    .from('dispute_cases')
    .select('id')
    .eq('application_uuid', applicationUuid)
    .maybeSingle()

  if (caseErr && !isMissingRelation(caseErr)) {
    return { ok: false, error: caseErr.message }
  }

  let caseDeleted = false
  if (caseRow?.id) {
    const { error: delErr } = await db.from('dispute_cases').delete().eq('id', caseRow.id)
    if (delErr && !isMissingRelation(delErr)) {
      return { ok: false, error: delErr.message }
    }
    caseDeleted = !delErr
  }

  return { ok: true, sessionsDeleted: sessions.length, caseDeleted }
}
