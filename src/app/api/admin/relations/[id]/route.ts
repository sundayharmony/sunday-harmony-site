import { NextRequest, NextResponse } from 'next/server'
import { getMarketingProspect, updateProspectOnboarding, uploadProspectFile } from '@/lib/marketing-crm'
import { marketingActor, marketingError } from '@/lib/marketing-http'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  try {
    const { id } = await params
    const body = await req.json()
    const prospect = await updateProspectOnboarding(id, body, marketingActor(session))
    return NextResponse.json({ prospect })
  } catch (error) {
    return marketingError(error)
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (session.user.role !== 'admin' && session.user.role !== 'client_relations') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id } = await params
    const existing = await getMarketingProspect(id)
    if (!existing || existing.stage !== 'won') {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })
    }
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file' }, { status: 400 })
    const prospect = await uploadProspectFile(id, {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      data: Buffer.from(await file.arrayBuffer()),
    })
    return NextResponse.json({ prospect })
  } catch (error) {
    return marketingError(error)
  }
}
