import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Retired. Business funding uses /funding. */
export async function POST() {
  return NextResponse.json({ error: 'Use the funding form at /funding.' }, { status: 410 })
}
