import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { hashPassword } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const hashedPass = hashPassword('12345678')
    const { error } = await getSupabase()
      .from('users')
      .update({ password: hashedPass })
      .eq('email', 'sales@sundayharmony.com')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
