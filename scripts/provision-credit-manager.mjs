/**
 * Provision a staff credit_manager (or other role) in production Supabase + send setup email.
 * Usage:
 *   npx tsx scripts/provision-credit-manager.mjs --email user@example.com --name "Full Name" [--role credit_manager] [--site-url https://www.sundayharmony.com]
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { hashPassword } from '../src/lib/password-crypto.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const SETUP_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function loadEnv(filePath) {
  const env = {}
  if (!fs.existsSync(filePath)) return env
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let val = trimmed.slice(eq + 1)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = unquoteEnvValue(val)
  }
  return env
}

function unquoteEnvValue(val) {
  if (val === undefined || val === null) return ''
  let v = String(val).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (v.startsWith('\\"') && v.endsWith('\\"')) v = v.slice(2, -2)
  return v.trim()
}

function mergeEnvLayers(...layers) {
  const out = {}
  for (const layer of layers) {
    for (const [key, raw] of Object.entries(layer || {})) {
      const val = unquoteEnvValue(raw)
      if (val) out[key] = val
    }
  }
  return out
}

function applyEnv(env) {
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined && v !== '') process.env[k] = v
  }
}


function mergeProcessEnv(env, keys) {
  const out = { ...env }
  for (const key of keys) {
    const v = process.env[key]?.trim()
    if (v) out[key] = v
  }
  return out
}
function parseArgs(argv) {
  const out = { role: 'credit_manager', siteUrl: 'https://www.sundayharmony.com' }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--email') out.email = argv[++i]
    else if (a === '--name') out.name = argv[++i]
    else if (a === '--role') out.role = argv[++i]
    else if (a === '--site-url') out.siteUrl = argv[++i]
  }
  return out
}

function tokenPepper() {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret) throw new Error('NEXTAUTH_SECRET is required to hash verification tokens')
  return secret
}

function hashVerificationToken(plain) {
  const normalized = plain.trim().replace(/\s/g, '')
  const h = crypto.createHmac('sha256', tokenPepper()).update(normalized).digest('hex')
  return `hmac:${h}`
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getSmtpPort() {
  const p = parseInt(process.env.SMTP_PORT || '587', 10)
  return Number.isFinite(p) && p > 0 ? p : 587
}

function getDefaultFromAddress(displayName = 'Sunday Harmony') {
  const from = process.env.SMTP_FROM_EMAIL?.trim() || process.env.SMTP_USER?.trim() || 'sales@sundayharmony.com'
  if (from.includes('<')) return from
  return `"${displayName}" <${from}>`
}

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()
  )
}

async function sendSetupEmail({ to, name, setupCode, resetUrl }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST.trim(),
    port: getSmtpPort(),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASS,
    },
  })

  const firstName = escHtml((name || 'there').split(' ')[0])
  const subject = 'Set Up Your Sunday Harmony Credit Manager Access'

  const html = `
    <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
        Credit Manager Access
      </h2>
      <p>Hi ${firstName},</p>
      <p>Your Sunday Harmony <strong>Credit Manager</strong> account is ready. Use the one-time setup code below to choose your password and sign in.</p>
      <div style="text-align:center;margin:30px 0">
        <div style="background:#f5f0e6;border:2px solid #c9a96e;border-radius:12px;padding:20px 40px;display:inline-block">
          <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#333">${escHtml(setupCode)}</span>
        </div>
      </div>
      <p style="color:#525252;line-height:1.6">Open the password setup page, enter this code with your email, and create your password:</p>
      <p style="margin:24px 0;text-align:center">
        <a href="${escHtml(resetUrl)}" style="display:inline-block;padding:12px 24px;background:#0a0a0a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
          Set Up Password
        </a>
      </p>
      <p style="font-size:12px;color:#888;line-height:1.5">If the button does not work, copy this link:<br />
        <a href="${escHtml(resetUrl)}" style="color:#b8943f;word-break:break-all">${escHtml(resetUrl)}</a>
      </p>
      <p style="color:#525252;line-height:1.6;font-size:14px">After setup you can use the <strong>Credit &amp; Funding</strong> panel and <strong>team messaging</strong> in the admin portal.</p>
      <p style="font-size:13px;color:#666">This code expires in 7 days. If you did not expect this email, contact Sunday Harmony support.</p>
      <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
        &mdash; Sunday Harmony
      </p>
    </div>
  `

  await transporter.sendMail({
    from: getDefaultFromAddress(),
    to,
    subject,
    html,
  })
}

function deriveNameFromEmail(email) {
  const local = email.split('@')[0] || 'User'
  return local
    .replace(/[._+-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

async function assertMigration021(supabase) {
  const { error } = await supabase.from('staff_messages').select('id').limit(1)
  if (error && (error.message?.includes('staff_messages') || error.code === 'PGRST205')) {
    return 'Migration 021 is not applied (missing staff_messages / credit_manager role). Run supabase-migration-021-credit-manager-role.sql in the Supabase SQL Editor, or: node scripts/apply-migration-021.mjs with a valid POSTGRES_URL_NON_POOLING.'
  }
  return null
}

async function main() {
  const args = parseArgs(process.argv)
  const fileEnv = loadEnv(path.join(root, '.env.local'))
  const extraEnvFile = process.argv.includes('--env-file')
    ? loadEnv(process.argv[process.argv.indexOf('--env-file') + 1])
    : {
        ...loadEnv(path.join(root, '.env.production.local')),
        ...loadEnv(path.join(root, '.env.vercel.production')),
      }
  applyEnv(
    mergeProcessEnv(
      { ...extraEnvFile, ...fileEnv },
      [
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SMTP_HOST',
        'SMTP_USER',
        'SMTP_PASS',
        'SMTP_FROM_EMAIL',
        'SMTP_PORT',
        'SMTP_SECURE',
        'NEXTAUTH_SECRET',
      ]
    )
  )

  const email = (args.email || '').trim().toLowerCase()
  const role = (args.role || 'credit_manager').trim()
  const siteUrl = (args.siteUrl || 'https://www.sundayharmony.com').replace(/\/+$/, '')
  const name = (args.name || deriveNameFromEmail(email)).trim()

  const result = {
    email,
    role,
    accountCreated: false,
    accountExisted: false,
    roleUpdated: false,
    setupCodeStored: false,
    emailSent: false,
    errors: [],
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    result.errors.push('Valid --email is required')
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceKey) {
    result.errors.push('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }

  if (!isEmailConfigured()) {
    result.errors.push('SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)')
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const migrationBlock = await assertMigration021(supabase)
  if (migrationBlock) {
    result.errors.push(migrationBlock)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }

  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('id, email, name, role')
    .ilike('email', email)
    .maybeSingle()

  if (fetchError) {
    result.errors.push(`Failed to fetch user: ${fetchError.message}`)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }

  let userId = existing?.id

  if (!existing) {
    const tempPassword = `${crypto.randomBytes(12).toString('base64url')}A1!`
    const { data: created, error: createError } = await supabase
      .from('users')
      .insert({
        email,
        password: hashPassword(tempPassword),
        name,
        role,
      })
      .select('id')
      .single()

    if (createError || !created) {
      result.errors.push(`Failed to create user: ${createError?.message || 'unknown'}`)
      console.log(JSON.stringify(result, null, 2))
      process.exit(1)
    }
    userId = created.id
    result.accountCreated = true
  } else {
    result.accountExisted = true
    if (existing.role !== role) {
      const { error: roleError } = await supabase.from('users').update({ role }).eq('id', existing.id)
      if (roleError) {
        result.errors.push(`Failed to update role: ${roleError.message}`)
        console.log(JSON.stringify(result, null, 2))
        process.exit(1)
      }
      result.roleUpdated = true
    }
    if (name && existing.name !== name) {
      await supabase.from('users').update({ name }).eq('id', existing.id)
    }
  }

  const setupCode = crypto.randomInt(100000, 999999).toString()
  const expires = new Date(Date.now() + SETUP_CODE_TTL_MS).toISOString()

  const { error: tokenError } = await supabase
    .from('users')
    .update({
      reset_token: hashVerificationToken(setupCode),
      reset_token_expires: expires,
    })
    .eq('id', userId)

  if (tokenError) {
    result.errors.push(`Failed to store setup code: ${tokenError.message}`)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  result.setupCodeStored = true

  const resetUrl = `${siteUrl}/reset-password?email=${encodeURIComponent(email)}`

  try {
    await sendSetupEmail({ to: email, name, setupCode, resetUrl })
    result.emailSent = true
  } catch (err) {
    result.errors.push(`Failed to send email: ${err instanceof Error ? err.message : String(err)}`)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.log(
    JSON.stringify(
      {
        accountCreated: false,
        accountExisted: false,
        emailSent: false,
        errors: [err instanceof Error ? err.message : String(err)],
      },
      null,
      2
    )
  )
  process.exit(1)
})
