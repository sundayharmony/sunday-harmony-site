import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import {
  createCaseStudy,
  deleteCaseStudy,
  listCaseStudiesForAdmin,
  parseCaseStudyFields,
  updateCaseStudy,
} from '@/lib/case-studies'
import { requireAdminSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function studyId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  const result = await listCaseStudiesForAdmin()
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ caseStudies: result.caseStudies })
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = parseCaseStudyFields(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const result = await createCaseStudy(parsed.value)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, caseStudy: result.caseStudy })
  } catch (error) {
    logApiRouteError(req, 'admin/case-studies', error)
    return NextResponse.json({ error: 'The case study could not be saved.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  try {
    const body = await req.json().catch(() => ({}))
    const id = studyId(body.id)
    if (!id) return NextResponse.json({ error: 'Case study is required.' }, { status: 400 })
    const parsed = parseCaseStudyFields(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const result = await updateCaseStudy(id, parsed.value)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, caseStudy: result.caseStudy })
  } catch (error) {
    logApiRouteError(req, 'admin/case-studies', error)
    return NextResponse.json({ error: 'The case study could not be saved.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  try {
    const body = await req.json().catch(() => ({}))
    const id = studyId(body.id)
    if (!id) return NextResponse.json({ error: 'Case study is required.' }, { status: 400 })
    const result = await deleteCaseStudy(id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true })
  } catch (error) {
    logApiRouteError(req, 'admin/case-studies', error)
    return NextResponse.json({ error: 'The case study could not be removed.' }, { status: 500 })
  }
}
