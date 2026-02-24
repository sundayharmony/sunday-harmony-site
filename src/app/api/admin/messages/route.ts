import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getMessages, createMessage } from '@/lib/db'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  const messages = clientId ? getMessages(clientId) : getMessages()
  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { clientId, text } = await request.json()
  if (!clientId || !text?.trim()) {
    return NextResponse.json({ error: 'clientId and text required' }, { status: 400 })
  }

  const message = createMessage({
    clientId,
    fromRole: 'admin',
    fromName: session.user.name || 'Sunday Harmony',
    text: text.trim(),
  })

  return NextResponse.json(message)
}
