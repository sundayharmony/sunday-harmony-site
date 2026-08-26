import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isStaffRole } from '@/lib/staff-roles'
import { getUserCredentials, deleteCredential } from '@/lib/webauthn'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!session.user.mfaVerified) {
    return NextResponse.json({ error: 'MFA required' }, { status: 403 })
  }

  try {
    const credentials = await getUserCredentials(session.user.id)

    return NextResponse.json({
      credentials: credentials.map((c) => ({
        id: c.id,
        friendlyName: c.friendly_name,
        deviceType: c.device_type,
        backedUp: c.backed_up,
        createdAt: c.created_at,
        lastUsedAt: c.last_used_at,
      })),
    })
  } catch (e) {
    console.error('List passkeys error:', e)
    return NextResponse.json({ error: 'Failed to list passkeys' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!session.user.mfaVerified) {
    return NextResponse.json({ error: 'MFA required' }, { status: 403 })
  }

  const url = new URL(request.url)
  const credentialId = url.searchParams.get('id')

  if (!credentialId) {
    return NextResponse.json({ error: 'Missing credential id' }, { status: 400 })
  }

  try {
    const deleted = await deleteCredential(session.user.id, credentialId)

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete passkey' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Delete passkey error:', e)
    return NextResponse.json({ error: 'Failed to delete passkey' }, { status: 500 })
  }
}
