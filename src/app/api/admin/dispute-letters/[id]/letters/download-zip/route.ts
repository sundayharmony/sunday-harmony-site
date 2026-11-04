import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { disputeLettersJson } from '@/lib/dispute-letters/api-client'
import { currentLetters } from '@/lib/dispute-letters/current-letters'
import { listDisputeSessionsForApplication } from '@/lib/dispute-letters/db'
import { getRoundNumberForSession } from '@/lib/dispute-letters/dispute-lifecycle-db'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import {
  disputeLetterRoundIndex,
  disputeLettersZipDownloadName,
} from '@/lib/dispute-letters-storage'
import {
  buildLetterZipFiles,
  fetchLetterDocxFilesForZip,
  loadLetterIdentityAttachments,
} from '@/lib/dispute-letters/letter-identity-attachments'
import { zipFiles } from '@/lib/dispute-letters/letter-zip'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Parallel letter builds still need headroom for cold starts + enclosure merge. */
export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

type LetterListItem = { id: string; title?: string; plan_id?: string }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  const email = session.user?.email
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = await disputeLettersJson<{ letters: LetterListItem[] }>(`/internal/letters/${id}`)
    const letters = currentLetters(payload.letters || [])
    if (!letters.length) {
      return NextResponse.json({ error: 'No letters' }, { status: 404 })
    }

    const row = access.session
    const attachments = await loadLetterIdentityAttachments(row.application_uuid)
    const letterFiles = await fetchLetterDocxFilesForZip(id, letters, attachments)
    const files = buildLetterZipFiles(letterFiles)

    let round = (await getRoundNumberForSession(id)) || 0
    if (!round && row.application_uuid) {
      const sessions = await listDisputeSessionsForApplication(row.application_uuid)
      round = disputeLetterRoundIndex(sessions, id)
    }
    if (!round) round = 1
    const filename = disputeLettersZipDownloadName(row.report_json?.consumer?.name, round)
    const zip = zipFiles(files)

    try {
      const { recordLetterPackageDownload } = await import('@/lib/dispute-letters/dispute-lifecycle-db')
      await recordLetterPackageDownload(id)
    } catch (hookErr) {
      console.error('recordLetterPackageDownload hook failed:', hookErr)
    }

    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
      },
    })
  } catch (err) {
    console.error('zip download error:', err)
    const message = err instanceof Error ? err.message : 'ZIP download failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
