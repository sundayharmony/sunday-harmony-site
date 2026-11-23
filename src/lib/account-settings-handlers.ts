import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { getUserById, getUserByEmail, updateUser, verifyPassword } from '@/lib/db'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'

type AccountSettingsOptions = {
  requireSession: () => Promise<Session | NextResponse>
  /** Prefix for the password-change rate limit key. */
  rateLimitKey: string
  /** Route path used in error logs. */
  routePath: string
}

/** GET (profile) and PUT (password change) handlers shared by the client and staff settings routes. */
export function createAccountSettingsHandlers({ requireSession, rateLimitKey, routePath }: AccountSettingsOptions) {
  async function GET() {
    try {
      const session = await requireSession()
      if (session instanceof NextResponse) return session
      const user = session.user
      const userId = user.id

      // Try by ID first, fall back to email lookup
      let userData = await getUserById(userId)
      if (!userData && user.email) {
        userData = (await getUserByEmail(user.email)) || undefined
      }
      if (!userData) {
        // If no DB record, return session data so settings page still loads
        return NextResponse.json(
          {
            id: userId,
            name: user.name || '',
            email: user.email || '',
          },
          { status: 200 }
        )
      }

      return NextResponse.json(
        {
          id: userData.id,
          name: userData.name || '',
          email: userData.email || '',
        },
        { status: 200 }
      )
    } catch (error: unknown) {
      console.error(`GET ${routePath} error:`, error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  async function PUT(request: NextRequest) {
    try {
      const session = await requireSession()
      if (session instanceof NextResponse) return session
      const user = session.user
      const userId = user.id

      // Rate limit: 5 password change attempts per 15 minutes per IP
      const ip = getClientIp(request)
      const rl = await rateLimitDurable(`${rateLimitKey}:${ip}`, 5, 15 * 60 * 1000)
      if (!rl.allowed) return rateLimitResponse(rl.resetIn)

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

      if (userData.id !== userId) {
        return NextResponse.json({ error: 'Session mismatch' }, { status: 403 })
      }

      const isValid = verifyPassword(currentPassword, userData.password)
      if (!isValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      }

      const result = await updateUser(userData.id, { password: newPassword })
      if (!result) {
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
      }

      return NextResponse.json({ message: 'Password updated successfully' }, { status: 200 })
    } catch (error: unknown) {
      console.error(`PUT ${routePath} error:`, error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  return { GET, PUT }
}
