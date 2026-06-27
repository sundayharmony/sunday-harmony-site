import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveClientActivityAccess } from '@/lib/dashboard-activity-auth'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  const access = resolveClientActivityAccess(session)

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const { data, error } = await getSupabase()
      .from('activity_log')
      .select('*')
      .eq('entity_id', access.clientId)
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
