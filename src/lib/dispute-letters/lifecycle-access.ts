import { NextResponse } from 'next/server'
import { creditApplicationAccessDenied, viewerFromSession } from '@/lib/credit-expert-assignment'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import { getSupabase } from '@/lib/supabase'

/** Things a letter-tracking request can point at. */
export type LifecycleTarget = 'session' | 'letter' | 'package' | 'round' | 'item'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function caseApplication(caseId: unknown): Promise<string | null> {
  if (typeof caseId !== 'string' || !caseId) return null
  const { data } = await getSupabase()
    .from('dispute_cases')
    .select('application_uuid')
    .eq('id', caseId)
    .maybeSingle()
  return (data?.application_uuid as string | null) || null
}

async function sessionApplication(sessionId: unknown): Promise<string | null> {
  if (typeof sessionId !== 'string' || !sessionId) return null
  const { data } = await getSupabase()
    .from('dispute_sessions')
    .select('application_uuid')
    .eq('id', sessionId)
    .maybeSingle()
  return (data?.application_uuid as string | null) || null
}

/** The client application a session, letter, package, round or item belongs to. */
export async function lifecycleTargetApplication(kind: LifecycleTarget, id: string): Promise<string | null> {
  if (!UUID.test(id)) return null
  const db = getSupabase()
  if (kind === 'session') return sessionApplication(id)
  if (kind === 'letter') {
    const { data } = await db.from('dispute_letters').select('session_id').eq('id', id).maybeSingle()
    return sessionApplication(data?.session_id)
  }
  const table = { package: 'dispute_letter_packages', round: 'dispute_rounds', item: 'dispute_items' }[kind]
  const { data } = await db.from(table).select('case_id').eq('id', id).maybeSingle()
  return caseApplication(data?.case_id)
}

/**
 * Admins may act on any client. A credit expert only on clients assigned to them, and never
 * on a record that can't be traced to a client. Returns a 404 response when denied.
 */
export async function lifecycleAccessDenied(
  session: { user?: { role?: string | null; id?: string | null } },
  kind: LifecycleTarget,
  id: string
): Promise<NextResponse | null> {
  if (session.user?.role === 'admin') return null
  const notFound = NextResponse.json({ error: 'Not found' }, { status: 404 })
  const applicationUuid = await lifecycleTargetApplication(kind, id)
  if (!applicationUuid) return notFound
  const application = await getCreditFundingApplicationById(applicationUuid)
  return creditApplicationAccessDenied(viewerFromSession(session), application)
}
