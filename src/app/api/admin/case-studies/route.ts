import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import {
  removeCaseStudyByPublicUrlIfOurs,
  removeCaseStudyByStoragePath,
  uploadCaseStudyPdf,
} from '@/lib/client-case-studies-storage'
import {
  deleteClientCaseStudy,
  getAllCaseStudiesForAdmin,
  getCaseStudyByClientId,
  getClientById,
  updateClientCaseStudy,
  upsertClientCaseStudy,
} from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const studies = await getAllCaseStudiesForAdmin()
  return NextResponse.json(studies)
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  let uploadedPublicUrl: string | null = null
  let uploadedStoragePath: string | null = null

  try {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const clientIdRaw = formData.get('client_id')
    const client_id = typeof clientIdRaw === 'string' ? clientIdRaw.trim() : ''
    if (!client_id) {
      return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
    }

    const client = await getClientById(client_id)
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const fileEntry = formData.get('file')
    if (!fileEntry || typeof fileEntry === 'string' || !('arrayBuffer' in fileEntry)) {
      return NextResponse.json({ error: 'Missing PDF file' }, { status: 400 })
    }

    const titleRaw = formData.get('title')
    const title =
      typeof titleRaw === 'string' && titleRaw.trim()
        ? titleRaw.trim().slice(0, 200)
        : client.business || client.name

    const publishedRaw = formData.get('published')
    const published = publishedRaw !== 'false'

    const arrayBuffer = await fileEntry.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = fileEntry.type || 'application/pdf'

    const existing = await getCaseStudyByClientId(client_id)
    if (existing) {
      await removeCaseStudyByStoragePath(existing.storage_path)
    }

    const up = await uploadCaseStudyPdf({
      clientId: client_id,
      buffer,
      contentType,
      originalFileName: fileEntry.name || 'case-study.pdf',
    })

    if (!up.ok) {
      return NextResponse.json({ error: up.error }, { status: 400 })
    }

    const { publicUrl, objectPath, file_size } = up.data
    uploadedPublicUrl = publicUrl
    uploadedStoragePath = objectPath

    const record = await upsertClientCaseStudy({
      client_id,
      title,
      file_url: publicUrl,
      storage_path: objectPath,
      file_size,
      published,
      uploaded_by_name: session.user.name || session.user.email || 'Admin',
    })

    if (!record) {
      await removeCaseStudyByStoragePath(uploadedStoragePath)
      uploadedPublicUrl = null
      uploadedStoragePath = null
      return NextResponse.json({ error: 'Failed to save case study record' }, { status: 500 })
    }

    uploadedPublicUrl = null
    uploadedStoragePath = null

    return NextResponse.json(record, { status: existing ? 200 : 201 })
  } catch (err) {
    console.error('POST /api/admin/case-studies error:', err)
    if (uploadedStoragePath) {
      await removeCaseStudyByStoragePath(uploadedStoragePath)
    } else if (uploadedPublicUrl) {
      await removeCaseStudyByPublicUrlIfOurs(uploadedPublicUrl)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const updates: { title?: string; published?: boolean } = {}
    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim().slice(0, 200)
    }
    if (typeof body.published === 'boolean') {
      updates.published = body.published
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await updateClientCaseStudy(id, updates)
    if (!updated) {
      return NextResponse.json({ error: 'Case study not found or update failed' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH /api/admin/case-studies error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const removed = await deleteClientCaseStudy(id)
    if (!removed) {
      return NextResponse.json({ error: 'Case study not found' }, { status: 404 })
    }

    await removeCaseStudyByStoragePath(removed.storage_path)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/case-studies error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
