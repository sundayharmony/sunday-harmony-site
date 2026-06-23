import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { removeClientFileByPublicUrlIfOurs, uploadClientFileToVault } from '@/lib/client-files-storage'
import { createFileRecord, createNotification, getClientById } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'
import {
  clientDashboardAlertEmailHtml,
  isEmailConfigured,
  sanitizeEmailSubjectPart,
  sendHtmlMailNonBlocking,
} from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CATEGORY_OK = new Set(['report', 'graphic', 'content', 'brand', 'general'])

export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const ip = getClientIp(request)
  const rl = await rateLimitDurable(`admin-file-upload:${ip}`, 30, 15 * 60 * 1000)
  if (!rl.allowed) return rateLimitResponse(rl.resetIn)

  let uploadedObjectPath: string | null = null

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
      clientId: client_id,
      buffer,
      contentType,
      originalFileName: fileEntry.name || 'upload',
      displayNameOverride: displayNameOverride || undefined,
    })

    if (!up.ok) {
      return NextResponse.json({ error: up.error }, { status: 400 })
    }

    const { objectPath, signedUrl, file_size, file_type, displayName } = up.data
    uploadedObjectPath = objectPath

    const fileRecord = await createFileRecord({
      client_id,
      name: displayName,
      file_url: objectPath,
      file_size,
      file_type,
      category,
      uploaded_by_role: 'admin',
      uploaded_by_name: session.user.name || session.user.email || 'Admin',
    })

    if (!fileRecord) {
      await removeClientFileByPublicUrlIfOurs(objectPath)
      uploadedObjectPath = null
      return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
    }

    uploadedObjectPath = null

    try {
      const { data: clientUser } = await (
        getSupabase().from('users').select('id').eq('client_id', client_id).single()
      )

      if (clientUser) {
        await createNotification({
          user_id: clientUser.id,
          title: 'New File Shared',
          message: displayName,
          type: 'file',
          link: '/dashboard/files',
        })
      }
    } catch (notifErr) {
      console.error('Admin file upload: notification error:', notifErr)
    }

    if (isEmailConfigured() && client.email) {
      try {
        const first = (client.name || 'there').split(' ')[0]
        const html = clientDashboardAlertEmailHtml({
          heading: 'New File Shared',
          firstName: first,
          bodyParagraphs: [
            'The Sunday Harmony team shared a new file with you:',
            displayName,
          ],
          dashboardPath: '/dashboard/files',
        })
        sendHtmlMailNonBlocking({
          to: client.email,
          subject: sanitizeEmailSubjectPart(`New file: ${displayName}`),
          html,
          logLabel: 'admin-file-upload-to-client',
        })
      } catch (mailErr) {
        console.error('Admin file upload: client email failed:', mailErr)
      }
    }

    return NextResponse.json({ ...fileRecord, file_url: signedUrl }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/files/upload error:', err)
    if (uploadedObjectPath) {
      await removeClientFileByPublicUrlIfOurs(uploadedObjectPath)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
