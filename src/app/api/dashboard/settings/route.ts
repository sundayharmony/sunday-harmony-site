import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserById, updateUser, verifyPassword } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { id: string }
    const userId = user.id

    const userData = await getUserById(userId)
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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
    console.error('GET /api/dashboard/settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { id: string }
    const userId = user.id

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing currentPassword or newPassword' }, { status: 400 })
    }

    const userData = await getUserById(userId)
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
