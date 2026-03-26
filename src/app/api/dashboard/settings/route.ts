
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })undefined { NextRequest, NextResponse } from 'next/server'
    }

    const user = session.user as { id: string; email?: string }
    const userId = user.id

    // Rate limit: 5 password change attempts per 15 minutes per IP
    const ip = getClientIp(request)
    const rl = rateLimit(`settings-password:${ip}`, 5, 15 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing currentPassword or newPassword' }, { status: 400 })
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    }

    if (newPassword.length > 128) {
      return NextResponse.json({ error: 'Password is too long' }, { status: 400 })
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' },
        { status: 400 }
      )
    }

    // Try by ID first, fall back to email lookup
    let userData = await getUserById(userId)
    if (!userData && user.email) {
      userData = (await getUserByEmail(user.email)) || undefined
    }
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isValid = verifyPassword(currentPassword, userData.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    const result = await updateUser(userId, { password: newPassword })
    if (!result) {
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Password updated successfully' }, { status: 200 })
  } catch (error: unknown) {
    console.error('PUT /api/dashboard/settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserById, getUserByEmail, updateUser, verifyPassword } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { id: string; email?: string; name?: string }
    const userId = user.id

    // Try by ID first, fall back to email lookup
    let userData = await getUserById(userId)
    if (!userData && user.email) {
      userData = (await getUserByEmail(user.email)) || undefined
    }
    if (!userData) {
      // If no DB record, return session data so settings page still loads
      return NextResponse.json(

undefined
