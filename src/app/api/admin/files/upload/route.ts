import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { removeClientFileByPublicUrlIfOurs, uploadClientFileToVault } from '@/lib/client-files-storage'
import { createFileRecord, createNotification, getClientById } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CATEGORY_OK = new Set(['report', 'graphic', 'content', 'brand', 'general'])

export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  let uploadedPublicUrl: string | null = null

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

    const { publicUrl, file_size, file_type, displayName } = up.data
    uploadedPublicUrl = publicUrl

    const fileRecord = await createFileRecord({
      client_id,
      name: displayName,
      file_url: publicUrl,
      file_size,
      file_type,
      category,
      uploaded_by_role: 'admin',
      uploaded_by_name: session.user.name || session.user.email || 'Admin',
    })

    if (!fileRecord) {
      await removeClientFileByPublicUrlIfOurs(uploadedPublicUrl)
      uploadedPublicUrl = null
      return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
    }

    uploadedPublicUrl = null

    try {
      const sbClient = getSupabase()
        .from('users')
        .select('id')
        .eq('client_id', client_id)
        .single()

      if (sbClient.data) {
        await createNotification({
          user_id: sbClient.data.id,
          title: 'New File Shared',
          message: displayName,
          type: 'file',
          link: '/dashboard/files',
        })
      }
    } catch (notifErr) {
      console.error('Admin file upload: notification error:', notifErr)
    }

    return NextResponse.json(fileRecord, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/files/upload error:', err)
    if (uploadedPublicUrl) {
      await removeClientFileByPublicUrlIfOurs(uploadedPublicUrl)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
