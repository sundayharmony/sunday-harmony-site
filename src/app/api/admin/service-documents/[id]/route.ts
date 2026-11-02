import { NextResponse, type NextRequest } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import {
  getServiceDocument,
  updateServiceDocument,
  sendDocumentToClient,
} from '@/lib/service-documents'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const document = await getServiceDocument(id)
  
  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  return NextResponse.json({ document })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  
  try {
    const body = await request.json()
    
    const document = await updateServiceDocument(id, body)
    if (!document) {
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
    }

    return NextResponse.json({ document })
  } catch (err) {
    console.error('Failed to update service document:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  
  if (body.action === 'send') {
    const result = await sendDocumentToClient(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
