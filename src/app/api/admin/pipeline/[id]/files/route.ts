import { NextRequest, NextResponse } from 'next/server'
import { roleMayUsePipeline, uploadProspectFile } from '@/lib/marketing-crm'
import { marketingError } from '@/lib/marketing-http'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayUsePipeline(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id } = await params
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
