import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { getUserByEmail } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 requests per 15 minutes per IP
    const ip = getClientIp(req)
    const rl = rateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const { email } = await req.json()
    const normalizedEmail = (email || '').trim().toLowerCase()
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const smtpConfigured =
      Boolean(process.env.SMTP_HOST) &&
      Boolean(process.env.SMTP_USER) &&
      Boolean(process.env.SMTP_PASS)

    // Fail fast when reset delivery is unavailable so users/admins know
    // the flow is currently broken instead of receiving a false success.
    if (!smtpConfigured) {
      console.error('Forgot password unavailable: SMTP is not configured.')
      return NextResponse.json(
        { error: 'Password reset is temporarily unavailable. Please contact support.' },
        { status: 503 }
      )
    }

    const user = await getUserByEmail(normalizedEmail)

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' })
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

    // Store token in user record
    const { error: tokenError } = await getSupabase()
      .from('users')
      .update({ reset_token: token, reset_token_expires: expires })
      .eq('id', user.id)

    if (tokenError) {
      console.error('Failed to save reset token:', tokenError)
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }

    // Send reset email
    const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const resetUrl = `${siteUrl}/reset-password?token=${token}`

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    await transporter.sendMail({
      from: `"Sunday Harmony" <${process.env.SMTP_USER}>`,
      to: normalizedEmail,
      subject: 'Reset Your Password \u2014 Sunday Harmony',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
            Password Reset
          </h2>
          <p>Hi ${user.name},</p>
          <p>We received a request to reset your password. Click the button below to set a new one:</p>
          <div style="text-align:center;margin:30px 0">
            <a href="${resetUrl}" style="background:#c9a96e;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
              Reset Password
            </a>
          </div>
          <p style="font-size:13px;color:#666">This link expires in 1 hour. If you didn&rsquo;t request this, you can safely ignore this email.</p>
          <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
            &mdash; Sunday Harmony
          </p>
        </div>
      `,
    })
    return NextResponse.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
