import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { removeClientFileByPublicUrlIfOurs, resolveClientFileStoragePath, withSignedClientFileUrls } from '@/lib/client-files-storage'
import { getFilesByClient, createFileRecord, deleteFileRecord, createNotification, getFileById, getClientById } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'
import {
  clientDashboardAlertEmailHtml,
  isEmailConfigured,
  sanitizeEmailSubjectPart,
  sendHtmlMailNonBlocking,
} from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')

    if (!clientId) {
      return NextResponse.json({ error: 'Missing client_id query parameter' }, { status: 400 })
    }

    const files = await getFilesByClient(clientId)
    const signed = await withSignedClientFileUrls(files)
    return NextResponse.json(signed, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/admin/files error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const body = await request.json()
    const { client_id, name, file_url, file_size, file_type, category } = body

    if (!client_id || !name || !file_url || !file_type) {
      return NextResponse.json(
        { error: 'Missing required fields: client_id, name, file_url, file_type' },
        { status: 400 }
      )
    }

    if (!resolveClientFileStoragePath(String(file_url))) {
      return NextResponse.json(
        { error: 'file_url must be a valid client-files storage URL from an admin upload' },
        { status: 400 }
      )
    }

    const fileRecord = await createFileRecord({
      client_id,
      name,
      file_url,
      file_size: file_size || 0,
      file_type,
      category: category || '',
      uploaded_by_role: 'admin',
      uploaded_by_name: session.user.name || session.user.email || 'Admin',
    })

    if (!fileRecord) {
      return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
    }

    // Create notification for client
    const { data: notifyUser } = await (
      getSupabase().from('users').select('id').eq('client_id', client_id).single()
    )

    if (notifyUser) {
      await createNotification({
        user_id: notifyUser.id,
        title: 'New File Shared',
        message: name,
        type: 'file',
        link: '/dashboard/files',
      })
    }

    if (isEmailConfigured()) {
      try {
        const c = await getClientById(client_id)
        if (c?.email) {
          const first = (c.name || 'there').split(' ')[0]
          const html = clientDashboardAlertEmailHtml({
            heading: 'New File Shared',
            firstName: first,
            bodyParagraphs: [
              'The Sunday Harmony team shared a new file with you:',
              typeof name === 'string' ? name : String(name),
            ],
            dashboardPath: '/dashboard/files',
          })
          sendHtmlMailNonBlocking({
            to: c.email,
            subject: sanitizeEmailSubjectPart(`New file: ${name}`),
            html,
            logLabel: 'admin-file-json-to-client',
          })
        }
      } catch (mailErr) {
        console.error('Admin file (JSON): client email failed:', mailErr)
      }
    }

    return NextResponse.json(fileRecord, { status: 201 })
  } catch (error: unknown) {
    console.error('POST /api/admin/files error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing file id' }, { status: 400 })
    }

    const existing = await getFileById(id)
    if (!existing) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (existing.file_url) {
      await removeClientFileByPublicUrlIfOurs(existing.file_url)
    }

    const success = await deleteFileRecord(id)
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
    }

    return NextResponse.json({ message: 'File deleted successfully' }, { status: 200 })
  } catch (error: unknown) {
    console.error('DELETE /api/admin/files error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
