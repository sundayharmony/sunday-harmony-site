import { NextResponse } from 'next/server'
import { getClientIdFromSession, requireClientSession } from '@/lib/client-auth'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireClientSession()
  if (session instanceof NextResponse) return session
  const clientId = getClientIdFromSession(session)

  try {
    const { data, error } = await getSupabase()
      .from('activity_log')
      .select('id, action, entity_type, details, created_at')
      .eq('entity_id', clientId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('Activity log query error:', error)
      return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Activity log fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
