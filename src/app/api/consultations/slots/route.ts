import { NextResponse } from 'next/server'
import { loadPublicSlots } from '@/lib/consultation-service'

export const revalidate = 30

export async function GET() {
  try {
    const slots = await loadPublicSlots()
    return NextResponse.json(slots, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  } catch (error) {
    console.error('consultation slots failed:', error)
    return NextResponse.json(
      { error: 'Could not load open days. Refresh and try again.' },
      { status: 503 }
    )
  }
}
