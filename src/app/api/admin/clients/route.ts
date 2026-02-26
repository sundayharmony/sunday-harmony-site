import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getClients, createClient, updateClient, createUser, logActivity } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const tierLabels: Record<string, string> = {
  social_essentials: 'Social Essentials',
  spark: 'Spark',
  growth: 'Growth',
  scale: 'Scale',
}

export async function GET() {
  const clients = await getClients()
  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, business, email, phone, industry, packageTier, monthlyPrice, loginPassword, deliverables, quickWins } = body

  if (!name || !business || !email || !packageTier) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  // Validate package_tier is one of allowed values
  const allowedTiers = ['social_essentials', 'spark', 'growth', 'scale']
  if (!allowedTiers.includes(packageTier)) {
    return NextResponse.json({ error: 'Invalid package tier' }, { status: 400 })
  }

  // Validate monthly_price is positive
  if (monthlyPrice !== undefined && monthlyPrice !== null && monthlyPrice < 0) {
    return NextResponse.json({ error: 'Monthly price must be positive' }, { status: 400 })
  }

  const client = await createClient({
    name,
    business,
    email,
    phone,
    industry,
    package_tier: packageTier,
    monthly_price: monthlyPrice || 0,
    start_date: new Date().toISOString(),
    status: 'active',
    notes: '',
    deliverables: deliverables || [],
    quick_wins: quickWins || [],
  })

  if (!client) return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })

  const session = await getServerSession(authOptions)
  logActivity({
    action: 'created',
    entity_type: 'client',
    entity_id: client.id,
    actor_email: session?.user?.email || 'admin',
    details: `Created client "${name}" (${business}) on ${tierLabels[packageTier] || packageTier} plan`,
  })

  if (loginPassword) {
    await createUser({
      email,
      password: loginPassword,
      name,
      role: 'client',
      client_id: client.id,
    })

    // Send welcome email to client
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        })

        transporter.sendMail({
          from: `"Sunday Harmony" <${process.env.SMTP_USER}>`,
          to: email,
          subject: `Welcome to Sunday Harmony, ${escHtml(name.split(' ')[0])}!`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
                Welcome to Sunday Harmony
              </h2>
              <p>Hi ${escHtml(name.split(' ')[0])},</p>
              <p>We're excited to have <strong>${escHtml(business)}</strong> on board! Your <strong>${escHtml(tierLabels[packageTier] || packageTier)}</strong> package is now active.</p>
              <p>You can access your client dashboard to track progress, view deliverables, and message our team:</p>
              <div style="text-align:center;margin:30px 0">
                <a href="${siteUrl}/login" style="background:#c9a96e;color:#0a0a0f;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
                  Log In to Your Dashboard
                </a>
              </div>
              <div style="background:#f8f6f0;border-radius:8px;padding:16px;margin:20px 0">
                <p style="margin:0 0 8px;font-size:13px;color:#666"><strong>Your login details:</strong></p>
                <p style="margin:0;font-size:13px;color:#333">Email: <strong>${escHtml(email)}</strong></p>
                <p style="margin:0;font-size:13px;color:#333">Password: <strong>${escHtml(loginPassword)}</strong></p>
                <p style="margin:8px 0 0;font-size:11px;color:#999">We recommend changing your password after your first login.</p>
              </div>
              <p style="font-size:13px;color:#666">If you have any questions, simply reply to this email or use the messaging feature in your dashboard.</p>
              <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
                — The Sunday Harmony Team
              </p>
            </div>
          `,
        }).catch(err => console.error('Failed to send welcome email:', err))
      } catch (err) {
        console.error('Welcome email setup failed:', err)
      }
    }
  }

  return NextResponse.json(client)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
  const client = await updateClient(id, updates)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const changedFields = Object.keys(updates).join(', ')
  logActivity({
    action: 'updated',
    entity_type: 'client',
    entity_id: id,
    actor_email: session?.user?.email || 'admin',
    details: `Updated client "${client.name}": ${changedFields}`,
  })

  return NextResponse.json(client)
}
