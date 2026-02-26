import { NextResponse } from 'next/server'
import { getUserByEmail, createUser, seedAdmin } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Try seeding admin
    await seedAdmin()

    // Check if admin exists now
    const admin = await getUserByEmail('sales@sundayharmony.com')

    if (admin) {
      return NextResponse.json({
        success: true,
        message: 'Admin account exists',
        email: admin.email,
        name: admin.name,
        role: admin.role,
        id: admin.id,
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Admin account could not be created. Check Supabase connection and schema.',
      })
    }
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 })
  }
}
