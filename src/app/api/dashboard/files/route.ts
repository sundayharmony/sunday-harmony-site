import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { removeClientFileByPublicUrlIfOurs, uploadClientFileToVault } from '@/lib/client-files-storage'
import { getFilesByClient, createFileRecord, deleteFileRecord, getFileById } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CATEGORY_OK = new Set(['report', 'graphic', 'content', 'brand', 'general'])

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string; clientId?: string; name?: string; email?: string }
    if (user.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const clientId = user.clientId
    if (!clientId) {
      return NextResponse.json({ error: 'No client ID associated with user' }, { status: 400 })
    }

    const files = await getFilesByClient(clientId)
    return NextResponse.json(files, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/dashboard/files error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string; clientId?: string; name?: string; email?: string }
    if (user.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const clientId = user.clientId
    if (!clientId) {
      return NextResponse.json({ error: 'No client ID associated with user' }, { status: 400 })
    }

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

      const { publicUrl, file_size, file_type, displayName } = up.data

      const fileRecord = await createFileRecord({
        client_id: clientId,
        name: displayName,
        file_url: publicUrl,
        file_size,
        file_type,
        category,
        uploaded_by_role: 'client',
        uploaded_by_name: user.name || user.email || 'Client',
      })

      if (!fileRecord) {
        await removeClientFileByPublicUrlIfOurs(publicUrl)
        return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
      }

      return NextResponse.json(fileRecord, { status: 201 })
    }

    const body = await request.json()
    const { name, file_url, file_size, file_type, category } = body

    if (!name || !file_url || !file_type) {
      return NextResponse.json({ error: 'Missing required fields: name, file_url, file_type' }, { status: 400 })
    }

    const fileRecord = await createFileRecord({
      client_id: clientId,
      name,
      file_url,
      file_size: file_size || 0,
      file_type,
      category: category || '',
      uploaded_by_role: 'client',
      uploaded_by_name: user.name || user.email || 'Client',
    })

    if (!fileRecord) {
      return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
    }

    return NextResponse.json(fileRecord, { status: 201 })
  } catch (error: unknown) {
    console.error('POST /api/dashboard/files error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string; clientId?: string; name?: string; email?: string }
    if (user.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const clientId = user.clientId
    if (!clientId) {
      return NextResponse.json({ error: 'No client ID associated with user' }, { status: 400 })
    }

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
