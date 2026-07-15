import { NextRequest, NextResponse } from 'next/server'
import { getCaseStudyById } from '@/lib/db'
import { getCaseStudySignedUrl } from '@/lib/client-case-studies-storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const study = await getCaseStudyById(id)
  if (!study?.published) {
    return NextResponse.json({ error: 'Case study not found' }, { status: 404 })
  }

  const signedUrl = await getCaseStudySignedUrl(study.storage_path)
  if (!signedUrl) {
    return NextResponse.json({ error: 'Case study PDF unavailable' }, { status: 404 })
  }

  return NextResponse.redirect(signedUrl, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
    },
  })
}
