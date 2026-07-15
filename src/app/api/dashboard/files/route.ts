import { NextRequest, NextResponse } from 'next/server'
import { getClientIdFromSession, requireClientSession } from '@/lib/client-auth'
import {
  removeClientFileByPublicUrlIfOurs,
  resolveClientFileStoragePathForClient,
  uploadClientFileToVault,
  withSignedClientFileUrls,
} from '@/lib/client-files-storage'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { getFilesByClient, createFileRecord, deleteFileRecord, getFileById, getClientById } from '@/lib/db'
import {
  getAdminNotifyEmail,
  isEmailConfigured,
  sanitizeEmailSubjectPart,
  sendHtmlMailNonBlocking,
  staffPortalEmailHtml,
} from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CATEGORY_OK = new Set(['report', 'graphic', 'content', 'brand', 'general'])

async function notifyStaffClientFileUploaded(clientId: string, fileName: string) {
  if (!isEmailConfigured()) return
  try {
    const c = await getClientById(clientId)
    const who =
      c && (c.name || c.business)
        ? `${c.name || 'Client'}${c.business ? ` (${c.business})` : ''}`
        : 'A client'
    const html = staffPortalEmailHtml({
      heading: 'Client uploaded a file',
      bodyParagraphs: [`${who} uploaded a file to the client vault.`, `File: ${fileName}`],
      pathWithQuery: `/admin/files?client=${encodeURIComponent(clientId)}`,
    })
    sendHtmlMailNonBlocking({
      to: getAdminNotifyEmail(),
      subject: sanitizeEmailSubjectPart(`Client upload: ${fileName}`),
      html,
      logLabel: 'dashboard-file-to-staff',
    })
  } catch (e: unknown) {
    console.error('Dashboard file: staff notify email failed:', e)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireClientSession()
    if (session instanceof NextResponse) return session
    const clientId = getClientIdFromSession(session)

    const files = await getFilesByClient(clientId)
    const signed = await withSignedClientFileUrls(files)
    return NextResponse.json(signed, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/dashboard/files error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireClientSession()
    if (session instanceof NextResponse) return session
    const clientId = getClientIdFromSession(session)
    const user = session.user

    const ip = getClientIp(request)
    const rl = await rateLimitDurable(`dashboard-file-upload:${ip}`, 20, 15 * 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const contentTypeHeader = request.headers.get('content-type') || ''

    if (contentTypeHeader.includes('multipart/form-data')) {
      let formData: FormData
      try {
        formData = await request.formData()
      } catch {
        return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
      }

      const fileEntry = formData.get('file')
      if (!fileEntry || typeof fileEntry === 'string' || !('arrayBuffer' in fileEntry)) {
        return NextResponse.json({ error: 'Missing file' }, { status: 400 })
      }

      const nameRaw = formData.get('name')
      const displayNameOverride = typeof nameRaw === 'string' ? nameRaw.trim() : ''
      if (displayNameOverride.length > 300) {
        return NextResponse.json({ error: 'Display name is too long (max 300 characters)' }, { status: 400 })
      }

      const catRaw = formData.get('category')
      const category =
        typeof catRaw === 'string' && CATEGORY_OK.has(catRaw) ? catRaw : 'general'

      const arrayBuffer = await fileEntry.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const contentType = fileEntry.type || 'application/octet-stream'

      const up = await uploadClientFileToVault({
        clientId,
        buffer,
        contentType,
        originalFileName: fileEntry.name || 'upload',
        displayNameOverride: displayNameOverride || undefined,
      })

      if (!up.ok) {
        return NextResponse.json({ error: up.error }, { status: 400 })
      }

      const { objectPath, signedUrl, file_size, file_type, displayName } = up.data

      const fileRecord = await createFileRecord({
        client_id: clientId,
        name: displayName,
        file_url: objectPath,
        file_size,
        file_type,
        category,
        uploaded_by_role: 'client',
        uploaded_by_name: user.name || user.email || 'Client',
      })

      if (!fileRecord) {
        await removeClientFileByPublicUrlIfOurs(objectPath)
        return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
      }

      await notifyStaffClientFileUploaded(clientId, fileRecord.name)

      return NextResponse.json({ ...fileRecord, file_url: signedUrl }, { status: 201 })
    }

    const body = await request.json()
    const { name, file_url, file_size, file_type, category } = body

    if (!name || !file_url || !file_type) {
      return NextResponse.json({ error: 'Missing required fields: name, file_url, file_type' }, { status: 400 })
    }

    const ownedStoragePath = resolveClientFileStoragePathForClient(file_url, clientId)
    if (!ownedStoragePath) {
      return NextResponse.json(
        { error: 'Files must be uploaded through the secure upload form.' },
        { status: 400 }
      )
    }

    const fileRecord = await createFileRecord({
      client_id: clientId,
      name,
      file_url: ownedStoragePath,
      file_size: file_size || 0,
      file_type,
      category: category || '',
      uploaded_by_role: 'client',
      uploaded_by_name: user.name || user.email || 'Client',
    })

    if (!fileRecord) {
      return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
    }

    await notifyStaffClientFileUploaded(clientId, fileRecord.name)

    return NextResponse.json(fileRecord, { status: 201 })
  } catch (error: unknown) {
    console.error('POST /api/dashboard/files error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireClientSession()
    if (session instanceof NextResponse) return session
    const clientId = getClientIdFromSession(session)

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing file id' }, { status: 400 })
    }

    // Verify file belongs to this client before deleting (IDOR protection)
    const file = await getFileById(id)
    if (!file || file.client_id !== clientId) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (file.file_url) {
      await removeClientFileByPublicUrlIfOurs(file.file_url)
    }

    const success = await deleteFileRecord(id)
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
    }

    return NextResponse.json({ message: 'File deleted successfully' }, { status: 200 })
  } catch (error: unknown) {
    console.error('DELETE /api/dashboard/files error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
