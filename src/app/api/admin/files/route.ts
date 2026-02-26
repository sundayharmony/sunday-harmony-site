import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getFilesByClient, createFileRecord, deleteFileRecord, createNotification } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string; name?: string; email?: string }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')

    if (!clientId) {
      return NextResponse.json({ error: 'Missing client_id query parameter' }, { status: 400 })
    }

    const files = await getFilesByClient(clientId)
    return NextResponse.json(files, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/admin/files error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string; name?: string; email?: string }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { client_id, name, file_url, file_size, file_type, category } = body

    if (!client_id || !name || !file_url || !file_type) {
      return NextResponse.json(
        { error: 'Missing required fields: client_id, name, file_url, file_type' },
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
      uploaded_by_name: user.name || user.email || 'Admin',
    })

    if (!fileRecord) {
      return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
    }

    // Create notification for client
    const sbClient = await getSupabase()
      .from('users')
      .select('id')
      .eq('client_id', client_id)
      .single()

    if (sbClient.data) {
      await createNotification({
        user_id: sbClient.data.id,
        title: 'New File Shared',
        message: name,
        type: 'file',
        link: '/dashboard/files',
      })
    }

    return NextResponse.json(fileRecord, { status: 201 })
  } catch (error: unknown) {
    console.error('POST /api/admin/files error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { role?: string; name?: string; email?: string }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing file id' }, { status: 400 })
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
