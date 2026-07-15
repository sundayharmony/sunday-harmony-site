import { NextResponse } from 'next/server'
import { getPublishedCaseStudies } from '@/lib/db'
import { getCaseStudyPdfRoute } from '@/lib/client-case-studies-storage'

export const revalidate = 60

export async function GET() {
  try {
    const studies = await getPublishedCaseStudies()
    const payload = studies.map((s) => ({
      id: s.id,
      title: s.title,
      pdf_url: getCaseStudyPdfRoute(s.id),
      updated_at: s.updated_at,
    }))
    return NextResponse.json(payload)
  } catch (err) {
    console.error('GET /api/case-studies error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
