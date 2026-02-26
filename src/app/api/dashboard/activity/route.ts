import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as { role?: string }).role
  const clientId = (session.user as { clientId?: string }).clientId

  if (userRole !== 'client' && userRole !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch activity log entries related to this client
    let query = getSupabase()
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)

    // Clients only see their own activity
    if (userRole === 'client' && clientId) {
      query = query.eq('entity_id', clientId)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json([])
    }

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json([])
  }
}
