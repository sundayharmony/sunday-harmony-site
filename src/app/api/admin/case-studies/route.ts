import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import {
  getCaseStudyPublicUrl,
  isValidCaseStudyStoragePath,
  removeCaseStudyByStoragePath,
  validateCaseStudyPdf,
  verifyCaseStudyObject,
} from '@/lib/client-case-studies-storage'
import {
  deleteCaseStudy,
  getAllCaseStudiesForAdmin,
  getCaseStudyById,
  insertCaseStudy,
  updateCaseStudy,
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

  let uploadedStoragePath: string | null = null

  try {
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : ''
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const storagePath = typeof body.storagePath === 'string' ? body.storagePath.trim() : ''
    if (!storagePath || !isValidCaseStudyStoragePath(storagePath)) {
      return NextResponse.json({ error: 'Invalid storagePath' }, { status: 400 })
    }

    const file_size = typeof body.file_size === 'number' ? body.file_size : Number(body.file_size)
    if (!Number.isFinite(file_size) || file_size <= 0) {
      return NextResponse.json({ error: 'file_size is required' }, { status: 400 })
    }

    const pdfCheck = validateCaseStudyPdf('application/pdf', file_size)
    if (!pdfCheck.ok) {
      return NextResponse.json({ error: pdfCheck.error }, { status: 400 })
    }

    const published = body.published !== false

    const verification = await verifyCaseStudyObject(storagePath, file_size)
    if (!verification.ok) {
      await removeCaseStudyByStoragePath(storagePath)
      return NextResponse.json({ error: verification.error }, { status: 400 })
    }

    const publicUrl = getCaseStudyPublicUrl(storagePath)
    if (!publicUrl) {
      return NextResponse.json({ error: 'Could not resolve public URL' }, { status: 500 })
    }

    uploadedStoragePath = storagePath
    const uploadedBy = session.user.name || session.user.email || 'Admin'

    const record = await insertCaseStudy({
      title,
      file_url: publicUrl,
      storage_path: storagePath,
      file_size: verification.fileSize,
      published,
      uploaded_by_name: uploadedBy,
    })

    if (!record) {
      if (uploadedStoragePath) await removeCaseStudyByStoragePath(uploadedStoragePath)
      uploadedStoragePath = null
      return NextResponse.json({ error: 'Failed to save case study record' }, { status: 500 })
    }

    uploadedStoragePath = null
    return NextResponse.json(record, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/case-studies error:', err)
    if (uploadedStoragePath) {
      await removeCaseStudyByStoragePath(uploadedStoragePath)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  let newStoragePath: string | null = null

  try {
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const existing = await getCaseStudyById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Case study not found' }, { status: 404 })
    }

    const updates: {
      title?: string
      published?: boolean
      file_url?: string
      storage_path?: string
      file_size?: number
    } = {}

    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim().slice(0, 200)
    }
    if (typeof body.published === 'boolean') {
      updates.published = body.published
    }

    const storagePath = typeof body.storagePath === 'string' ? body.storagePath.trim() : ''
    if (storagePath) {
      if (!isValidCaseStudyStoragePath(storagePath)) {
        return NextResponse.json({ error: 'Invalid storagePath' }, { status: 400 })
      }

      const file_size = typeof body.file_size === 'number' ? body.file_size : Number(body.file_size)
      if (!Number.isFinite(file_size) || file_size <= 0) {
        return NextResponse.json({ error: 'file_size is required when replacing file' }, { status: 400 })
      }

      const pdfCheck = validateCaseStudyPdf('application/pdf', file_size)
      if (!pdfCheck.ok) {
        return NextResponse.json({ error: pdfCheck.error }, { status: 400 })
      }

      const verification = await verifyCaseStudyObject(storagePath, file_size)
      if (!verification.ok) {
        await removeCaseStudyByStoragePath(storagePath)
        return NextResponse.json({ error: verification.error }, { status: 400 })
      }

      const publicUrl = getCaseStudyPublicUrl(storagePath)
      if (!publicUrl) {
        return NextResponse.json({ error: 'Could not resolve public URL' }, { status: 500 })
      }

      updates.storage_path = storagePath
      updates.file_url = publicUrl
      updates.file_size = verification.fileSize
      newStoragePath = storagePath
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await updateCaseStudy(id, updates)
    if (!updated) {
      if (newStoragePath) {
        await removeCaseStudyByStoragePath(newStoragePath)
      }
      return NextResponse.json({ error: 'Case study not found or update failed' }, { status: 404 })
    }

    if (newStoragePath && existing.storage_path && existing.storage_path !== newStoragePath) {
      await removeCaseStudyByStoragePath(existing.storage_path)
    }

    newStoragePath = null
    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH /api/admin/case-studies error:', err)
    if (newStoragePath) {
      await removeCaseStudyByStoragePath(newStoragePath)
    }
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

    const removed = await deleteCaseStudy(id)
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
