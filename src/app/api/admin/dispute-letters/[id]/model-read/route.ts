import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { updateDisputeSessionReport } from '@/lib/dispute-letters/db'
import {
  applyGeminiRead,
  geminiReportMimeType,
  GEMINI_REPORT_MAX_BYTES,
  readReportWithGemini,
} from '@/lib/dispute-letters/gemini-report-read'
import { downloadDisputeLetterBytes } from '@/lib/dispute-letters-storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** One short Gemini read for a scan the local parser could not break into accounts. */
export const maxDuration = 30

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  const report = access.session.report_json
  if (!report) {
    return NextResponse.json({ error: 'Report is not ready' }, { status: 409 })
  }
  if ((report.tradelines || []).length > 0 || !process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ session_id: id, report })
  }

  const mimeType = geminiReportMimeType(access.session.file_name || '')
  if (!mimeType || !access.session.storage_path) {
    return NextResponse.json({ session_id: id, report })
  }

  try {
    const bytes = await downloadDisputeLetterBytes(access.session.storage_path)
    if (!bytes?.length || bytes.length > GEMINI_REPORT_MAX_BYTES) {
      return NextResponse.json({ session_id: id, report })
    }
    const read = await readReportWithGemini({
      bytes,
      mimeType,
      fileName: access.session.file_name || '',
    })
    if (!read.tradelines.length) {
      return NextResponse.json({ session_id: id, report })
    }
    const next = applyGeminiRead(report, read)
    await updateDisputeSessionReport(id, next, access.session.file_type || undefined)
    return NextResponse.json({ session_id: id, report: next })
  } catch (err) {
    console.error('gemini report read failed:', err instanceof Error ? err.name : 'error')
    return NextResponse.json({ session_id: id, report })
  }
}
