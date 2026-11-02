import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getServiceDocumentByToken,
  markDocumentViewed,
  signDocument,
  getServiceDocument,
  type ServiceDocument,
} from '@/lib/service-documents'

async function getDocumentForRequest(
  id: string,
  token: string | null,
  fromDashboard: boolean
): Promise<{ document: ServiceDocument | null; error?: string; status?: number }> {
  // Token-based access
  if (token) {
    const document = await getServiceDocumentByToken(token)
    if (!document || document.id !== id) {
      return { document: null, error: 'Invalid or expired link', status: 404 }
    }
    return { document }
  }
  
  // Authenticated client access from dashboard
  if (fromDashboard) {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email
    if (!email) {
      return { document: null, error: 'Not authenticated', status: 401 }
    }
    
    const document = await getServiceDocument(id)
    if (!document) {
      return { document: null, error: 'Document not found', status: 404 }
    }
    
    // Check if the document belongs to this client
    if (document.client_email.toLowerCase() !== email.toLowerCase()) {
      return { document: null, error: 'Access denied', status: 403 }
    }
    
    return { document }
  }
  
  return { document: null, error: 'Missing access token', status: 401 }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const fromDashboard = searchParams.get('from') === 'dashboard'

  const { document, error, status } = await getDocumentForRequest(id, token, fromDashboard)
  
  if (!document) {
    return NextResponse.json({ error }, { status: status || 401 })
  }

  if (document.status === 'cancelled' || document.status === 'expired') {
    return NextResponse.json({ error: 'This document is no longer valid' }, { status: 410 })
  }

  // Mark as viewed if not already
  await markDocumentViewed(id)

  // Return document without sensitive fields
  const safeDoc = {
    id: document.id,
    document_type: document.document_type,
    status: document.status,
    document_number: document.document_number,
    client_name: document.client_name,
    business_name: document.business_name,
    business_address: document.business_address,
    package_tier: document.package_tier,
    package_price: document.package_price,
    price_type: document.price_type,
    custom_scope: document.custom_scope,
    effective_date: document.effective_date,
    proposal_valid_until: document.proposal_valid_until,
    audit_findings: document.audit_findings,
    client_goals: document.client_goals,
    timeline_phases: document.timeline_phases,
    investment_items: document.investment_items,
    client_signature: document.client_signature,
    client_signature_type: document.client_signature_type,
    client_signed_at: document.client_signed_at,
    signed_at: document.signed_at,
  }

  return NextResponse.json({ document: safeDoc })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const fromDashboard = searchParams.get('from') === 'dashboard'

  const { document, error, status } = await getDocumentForRequest(id, token, fromDashboard)
  
  if (!document) {
    return NextResponse.json({ error }, { status: status || 401 })
  }

  if (document.status === 'signed') {
    return NextResponse.json({ error: 'Document has already been signed' }, { status: 400 })
  }

  if (document.status === 'cancelled' || document.status === 'expired') {
    return NextResponse.json({ error: 'This document is no longer valid' }, { status: 410 })
  }

  try {
    const body = await request.json()
    
    if (!body.signature || !body.signatureType) {
      return NextResponse.json({ error: 'Signature is required' }, { status: 400 })
    }

    // Get client IP
    const headersList = await headers()
    const forwarded = headersList.get('x-forwarded-for')
    const realIp = headersList.get('x-real-ip')
    const clientIp = forwarded?.split(',')[0]?.trim() || realIp || 'unknown'

    const result = await signDocument(id, {
      signature: body.signature,
      signatureType: body.signatureType,
      clientIp,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Failed to sign document:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
