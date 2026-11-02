import { NextResponse, type NextRequest } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import {
  createServiceDocument,
  getServiceDocumentsForStaff,
  type CreateDocumentInput,
} from '@/lib/service-documents'

export async function GET(request: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') as 'draft' | 'sent' | 'viewed' | 'signed' | undefined
  const type = searchParams.get('type') as 'agreement' | 'proposal' | undefined
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  const documents = await getServiceDocumentsForStaff({ status, type, limit })
  return NextResponse.json({ documents })
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json()
    
    const input: CreateDocumentInput = {
      document_type: body.document_type,
      client_name: body.client_name,
      client_email: body.client_email,
      business_name: body.business_name,
      business_address: body.business_address,
      package_tier: body.package_tier,
      package_price: body.package_price,
      price_type: body.price_type,
      custom_scope: body.custom_scope,
      effective_date: body.effective_date,
      proposal_valid_until: body.proposal_valid_until,
      audit_date: body.audit_date,
      audit_findings: body.audit_findings,
      client_goals: body.client_goals,
      timeline_phases: body.timeline_phases,
      investment_items: body.investment_items,
      created_by: session.user?.id || 'unknown',
    }

    const result = await createServiceDocument(input)
    if (!result) {
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
    }

    return NextResponse.json({
      document: result.document,
      accessToken: result.accessToken,
    })
  } catch (err) {
    console.error('Failed to create service document:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
