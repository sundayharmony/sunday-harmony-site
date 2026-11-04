import { NextResponse } from 'next/server'
import { requireClientSession } from '@/lib/client-auth'
import { getServiceDocumentsForClient } from '@/lib/service-documents'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireClientSession()
  if (session instanceof NextResponse) return session

  const email = session.user?.email
  if (!email) {
    return NextResponse.json({ error: 'No email in session' }, { status: 400 })
  }

  const documents = await getServiceDocumentsForClient(email)
  
  // Only return documents that have been sent to the client (not drafts)
  const visibleDocuments = documents.filter(doc => 
    doc.status !== 'draft' && doc.status !== 'cancelled'
  )

  return NextResponse.json(visibleDocuments)
}
