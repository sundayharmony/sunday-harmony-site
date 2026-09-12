import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import {
  CLIENT_FILES_BUCKET,
  sanitizeStorageFileName,
  uploadClientFileToVault,
  validateClientFile,
} from '@/lib/client-files-storage'
import type { DisputeResponseSource } from '@/lib/dispute-letters/dispute-lifecycle'
import {
  createDisputeResponse,
  listResponsesForRound,
} from '@/lib/dispute-letters/dispute-lifecycle-db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const RESPONSE_SOURCES = new Set<DisputeResponseSource>([
  'bureau',
  'furnisher',
  'collector',
  'cfpb',
  'other',
])

/** GET ?roundId= — list bureau/furnisher responses for a round. */
export async function GET(request: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const roundId = request.nextUrl.searchParams.get('roundId')?.trim()
  if (!roundId) {
    return NextResponse.json({ error: 'roundId is required' }, { status: 400 })
  }

  const responses = await listResponsesForRound(roundId)
  return NextResponse.json({ responses })
}

/** POST multipart: roundId, file, optional itemId/source/notes. */
export async function POST(request: NextRequest) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  try {
    const formData = await request.formData()
    const roundId = String(formData.get('roundId') || '').trim()
    const file = formData.get('file')
    const itemIdRaw = formData.get('itemId')
    const itemId = typeof itemIdRaw === 'string' && itemIdRaw.trim() ? itemIdRaw.trim() : null
    const sourceRaw = String(formData.get('source') || 'bureau').trim() as DisputeResponseSource
    const source = RESPONSE_SOURCES.has(sourceRaw) ? sourceRaw : 'bureau'
    const notesRaw = formData.get('notes')
    const notes = typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : null

    if (!roundId) {
      return NextResponse.json({ error: 'roundId is required' }, { status: 400 })
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = file.type || 'application/octet-stream'
    const v = validateClientFile(contentType, buffer.length)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

    const up = await uploadClientFileToVault({
      clientId: `dispute-responses/${roundId}`,
      buffer,
      contentType,
      originalFileName: file.name || sanitizeStorageFileName('response.pdf'),
    })
    if (!up.ok) {
      return NextResponse.json({ error: up.error }, { status: 400 })
    }

    const created = await createDisputeResponse({
      roundId,
      itemId,
      source,
      fileName: up.data.displayName,
      storagePath: up.data.objectPath,
      notes,
      uploadedBy: session.user.email || session.user.name || 'staff',
    })
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      response: created.row,
      bucket: CLIENT_FILES_BUCKET,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
