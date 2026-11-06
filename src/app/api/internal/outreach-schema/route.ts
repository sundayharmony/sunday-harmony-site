import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'
import { OUTREACH_SCHEMA_SQL } from '@/lib/outreach/schema-sql'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function authorized(request: NextRequest): boolean {
  const header = request.headers.get('authorization')
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const cron = process.env.CRON_SECRET?.trim()
  return Boolean(
    (secret && timingSafeStringEqual(header, `Bearer ${secret}`)) ||
      (cron && timingSafeStringEqual(header, `Bearer ${cron}`))
  )
}

function connectionString(): string {
  for (const key of ['POSTGRES_URL_NON_POOLING', 'POSTGRES_URL', 'DATABASE_URL', 'POSTGRES_PRISMA_URL']) {
    const value = process.env[key]?.trim() || ''
    if (!value.startsWith('postgres')) continue
    try {
      const parsed = new URL(value)
      parsed.searchParams.set('sslmode', 'no-verify')
      return parsed.toString()
    } catch {
      return value
    }
  }
  return ''
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return unauthorized()
  const conn = connectionString()
  if (!conn) {
    return NextResponse.json({ ok: false, error: 'Postgres connection is not configured.' }, { status: 500 })
  }
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query('BEGIN')
    await client.query(OUTREACH_SCHEMA_SQL)
    const settings = await client.query(
      `SELECT id, physical_mailing_address, settings_version,
              opt_out_verified_at IS NOT NULL AS has_opt_out_col
       FROM public.outreach_settings WHERE id = 1`
    )
    await client.query('COMMIT')
    const row = settings.rows[0] as Record<string, unknown> | undefined
    return NextResponse.json({
      ok: true,
      applied: ['054', '055'],
      mailingAddressPresent: Boolean(row?.physical_mailing_address),
      settingsVersion: row?.settings_version ?? null,
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'schema apply failed' },
      { status: 500 }
    )
  } finally {
    await client.end().catch(() => undefined)
  }
}
