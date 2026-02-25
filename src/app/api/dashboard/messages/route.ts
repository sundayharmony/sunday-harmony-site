import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getMessages, createMessage } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = session.user.clientId
  if (!clientId) {
    return NextResponse.json([])
  }

  const messages = await getMessages(clientId)
  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = session.user.clientId
  if (!clientId) {
    return NextResponse.json({ error: 'No client profile linked' }, { status: 400 })
  }

  const { text } = await request.json()
  if (!text?.trim()) {
    return NextResponse.json({ error: 'Message text required' }, { status: 400 })
  }

  const message = await createMessage({
    client_id: clientId,
    from_role: 'client',
    from_name: session.user.name || 'Client',
    text: text.trim(),
  })

  return NextResponse.json(message)
}
