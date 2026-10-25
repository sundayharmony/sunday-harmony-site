import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import {
  buildIntakePdfModel,
  collectIntakePdfFiles,
  intakePdfSourceFromApplication,
} from '@/lib/credit-funding-intake-pdf'
import { renderIntakePdf } from '@/lib/credit-funding-intake-pdf-server'
import { getCreditFundingApplicationById, getDocumentsByApplicationUuid } from '@/lib/credit-funding-db'
import { downloadCreditFundingDocument } from '@/lib/credit-funding-storage'
import { decryptApplicationSensitiveFields } from '@/lib/credit-funding-sensitive-fields'
import { logActivity } from '@/lib/db'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const { id } = await context.params
    const rl = await rateLimitDurable(
      `credit-funding-intake-pdf:${session.user.id || session.user.email}:${id}`,
      8,
      15 * 60 * 1000
    )
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const application = await getCreditFundingApplicationById(id)
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const documents = await getDocumentsByApplicationUuid(id)
    const decrypted = decryptApplicationSensitiveFields(application)
    const collected = await collectIntakePdfFiles(documents, async (storagePath) => {
      const downloaded = await downloadCreditFundingDocument(storagePath)
      return downloaded.ok ? downloaded.data : null
    })
    const model = buildIntakePdfModel(
      intakePdfSourceFromApplication(decrypted),
      { included: collected.files, skipped: collected.skipped },
      new Date()
    )
    const pdf = await renderIntakePdf(model, collected.files)

    logActivity({
      action: 'exported',
      entity_type: 'credit_funding_application',
      entity_id: id,
      actor_email: session.user.email || 'admin',
      details: `Downloaded intake PDF for ${application.application_id} with ${collected.files.length} files`,
    })

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${model.filename}"`,
        'Cache-Control': 'no-store, private',
      },
    })
  } catch (error) {
    logApiRouteError(req, 'admin/credit-funding/[id]/intake-pdf GET', error)
    return NextResponse.json({ error: 'Could not download the intake PDF' }, { status: 500 })
  }
}
