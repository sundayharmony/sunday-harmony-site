import { NextRequest, NextResponse } from 'next/server'
import {
  getClients,
  createClient,
  updateClient,
  deleteClient,
  getClientById,
  getFilesByClient,
  createUser,
  logActivity,
  getUserByEmail,
  createNotification,
} from '@/lib/db'
import { removeAllClientFilesFromVault, removeClientFileByPublicUrlIfOurs } from '@/lib/client-files-storage'
import { cleanupStripeForClient } from '@/lib/billing-service'
import { syncClientFromLead } from '@/lib/crm-db'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { isFreeTier, TIER_LIST_PRICES, type PackageTier } from '@/lib/stripe-catalog'
import { getPublicSiteUrl, isEmailConfigured, sanitizeEmailSubjectPart, sendHtmlMailNonBlocking } from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function sendNewClientWelcomeEmail(params: {
  to: string
  clientName: string
  business: string
  tierLabel: string
  siteUrl: string
  isPotential: boolean
  loginPassword?: string
}): void {
  const { to, clientName, business, tierLabel, siteUrl, isPotential, loginPassword } = params
  const first = (clientName || '').trim().split(/\s+/)[0] || 'there'
  const fn = escHtml(first)
  const biz = escHtml(business)
  const tier = escHtml(tierLabel)

  const intro = isPotential
    ? `<p>Hi ${fn},</p><p>Thank you for connecting with Sunday Harmony. We've added <strong>${biz}</strong> to our client list as a <strong>potential</strong> engagement and will follow up with next steps.</p>`
    : `<p>Hi ${fn},</p><p>We're excited to have <strong>${biz}</strong> on board! Your <strong>${tier}</strong> package is now active.</p>`

  const credentialsBlock = loginPassword
    ? `<div style="background:#f8f6f0;border-radius:8px;padding:16px;margin:20px 0">
        <p style="margin:0 0 8px;font-size:13px;color:#666"><strong>Your login details</strong></p>
        <p style="margin:0;font-size:13px;color:#333">Email: <strong>${escHtml(to)}</strong></p>
        <p style="margin:0;font-size:13px;color:#333">Password: <strong>${escHtml(loginPassword)}</strong></p>
        <p style="margin:8px 0 0;font-size:11px;color:#999">We recommend changing your password after your first login.</p>
      </div>`
    : `<p style="font-size:14px;color:#444;margin:16px 0">You can log in to your client dashboard with the email address above once your account has been activated. If you need access or have questions, reply to this email and we'll help right away.</p>`

  sendHtmlMailNonBlocking({
    to,
    subject: `Welcome to Sunday Harmony, ${sanitizeEmailSubjectPart(first || 'there', 60)}!`,
    html: `
            <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
                Welcome to Sunday Harmony
              </h2>
              ${intro}
              <p>You can use your client dashboard to track progress, view deliverables, and message our team:</p>
              <div style="text-align:center;margin:30px 0">
                <a href="${escHtml(siteUrl)}/login" style="background:#c9a96e;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
                  Open your dashboard
                </a>
              </div>
              ${credentialsBlock}
              <p style="font-size:13px;color:#666">If you have any questions, reply to this email or use the messaging feature in your dashboard.</p>
              <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
                - The Sunday Harmony Team
              </p>
            </div>
          `,
    logLabel: 'client-welcome',
  })
}

const tierLabels: Record<string, string> = {
  free: 'Free (Testing)',
  social_essentials: 'Social Essentials',
  spark: 'Spark',
  growth: 'Growth',
  scale: 'Scale',
}

export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const clients = await getClients()
  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { name, business, email, phone, industry, packageTier, monthlyPrice, loginPassword, deliverables, quickWins, isPotential, leadId } = body

  if (!name || !business || !email || !packageTier) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  // Validate package_tier is one of allowed values
  const allowedTiers = ['free', 'social_essentials', 'spark', 'growth', 'scale']
  if (!allowedTiers.includes(packageTier)) {
    return NextResponse.json({ error: 'Invalid package tier' }, { status: 400 })
  }

  if (monthlyPrice !== undefined && monthlyPrice !== null && monthlyPrice < 0) {
    return NextResponse.json({ error: 'Monthly price cannot be negative' }, { status: 400 })
  }

  const normalizedIsPotential = Boolean(isPotential)
  const isFree = packageTier === 'free'
  const normalizedMonthlyPrice = isFree
    ? 0
    : (monthlyPrice ?? TIER_LIST_PRICES[packageTier as PackageTier] ?? 0)

  const client = await createClient({
    name,
    business,
    email,
    phone,
    industry,
    package_tier: packageTier,
    monthly_price: normalizedMonthlyPrice,
    start_date: new Date().toISOString(),
    status: 'active',
    is_potential: normalizedIsPotential,
    billing_status: isFree ? 'paid' : 'not_started',
    notes: '',
    deliverables: deliverables || [],
    quick_wins: quickWins || [],
  })

  if (!client) return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })

  if (typeof leadId === 'string' && leadId.trim()) {
    await syncClientFromLead(leadId.trim(), client.id)
  }

  logActivity({
    action: 'created',
    entity_type: 'client',
    entity_id: client.id,
    actor_email: session.user.email || 'admin',
    details: `Created client "${name}" (${business}) on ${tierLabels[packageTier] || packageTier} plan`,
  })

  const trimmedPassword = typeof loginPassword === 'string' ? loginPassword.trim() : ''

  if (trimmedPassword) {
    const user = await createUser({
      email,
      password: trimmedPassword,
      name,
      role: 'client',
      client_id: client.id,
    })
    if (!user) {
      return NextResponse.json(
        { error: 'Client was saved but dashboard login could not be created (email may already exist). Fix in Supabase or use a different email.' },
        { status: 409 }
      )
    }
  }

  if (isEmailConfigured()) {
    try {
      sendNewClientWelcomeEmail({
        to: email,
        clientName: name,
        business,
        tierLabel: tierLabels[packageTier] || packageTier,
        siteUrl: getPublicSiteUrl(),
        isPotential: normalizedIsPotential,
        loginPassword: trimmedPassword || undefined,
      })
    } catch (err) {
      console.error('Welcome email setup failed:', err)
    }
  }

  return NextResponse.json(client)
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { id, ...rawUpdates } = await req.json()
  if (!id) return NextResponse.json({ error: 'Client ID required' }, { status: 400 })

  // Whitelist allowed fields to prevent arbitrary column injection
  const allowedFields = [
    'name', 'business', 'email', 'phone', 'industry', 'package_tier', 'monthly_price',
    'status', 'notes', 'deliverables', 'quick_wins', 'start_date',
    'is_potential', 'billing_status', 'stripe_customer_id', 'stripe_subscription_id',
    'last_payment_at', 'next_billing_date',
    'lead_type', 'marketing_lead_status', 'credit_funding_client_status', 'assigned_team_member', 'lead_id',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in rawUpdates) updates[key] = rawUpdates[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (typeof updates.package_tier === 'string') {
    const tier = updates.package_tier as PackageTier
    const allowedTiers = ['free', 'social_essentials', 'spark', 'growth', 'scale'] as const
    if (!allowedTiers.includes(tier as (typeof allowedTiers)[number])) {
      return NextResponse.json({ error: 'Invalid package tier' }, { status: 400 })
    }
    if (!('monthly_price' in updates)) {
      updates.monthly_price = isFreeTier(tier) ? 0 : TIER_LIST_PRICES[tier]
    }
  }

  const client = await updateClient(id, updates)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const changedFields = Object.keys(updates).join(', ')
  const statusFields = ['status', 'marketing_lead_status', 'credit_funding_client_status']
  const statusChanged = statusFields.some((f) => f in updates)

  logActivity({
    action: statusChanged ? 'status_changed' : 'updated',
    entity_type: 'client',
    entity_id: id,
    actor_email: session.user.email || 'admin',
    details: `Updated client "${client.name}": ${changedFields}`,
  })

  if (statusChanged && client.email) {
    sendHtmlMailNonBlocking({
      to: client.email,
      subject: sanitizeEmailSubjectPart(`Account Status Update — ${client.business}`, 200),
      html: `
        <p>Hi ${escHtml(client.name.split(/\s+/)[0] || 'there')},</p>
        <p>Your account status with Sunday Harmony has been updated. Log in to your portal for details.</p>
        <p><a href="${escHtml(getPublicSiteUrl())}/dashboard">Open dashboard</a></p>
      `,
      logLabel: 'client-status-update',
    })
    const user = await getUserByEmail(client.email)
    if (user) {
      await createNotification({
        user_id: user.id,
        title: 'Status Updated',
        message: 'Your account status has been updated.',
        type: 'info',
        link: '/dashboard',
      })
    }
  }

  return NextResponse.json(client)
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  if (!id) return NextResponse.json({ error: 'Client ID required' }, { status: 400 })

  const existing = await getClientById(id)
  if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const files = await getFilesByClient(id)
  await Promise.all(files.map(f => removeClientFileByPublicUrlIfOurs(f.file_url)))
  await removeAllClientFilesFromVault(id)
  await cleanupStripeForClient(id)

  const ok = await deleteClient(id)
  if (!ok) return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })

  logActivity({
    action: 'deleted',
    entity_type: 'client',
    entity_id: id,
    actor_email: session.user.email || 'admin',
    details: `Deleted client "${existing.name}" (${existing.business})`,
  })

  return NextResponse.json({ ok: true })
}
