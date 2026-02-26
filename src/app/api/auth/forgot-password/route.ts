import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { getUserByEmail } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await getUserByEmail(email)

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' })
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

    // Store token in user record
    await getSupabase()
      .from('users')
      .update({ reset_token: token, reset_token_expires: expires })
      .eq('id', user.id)

    // Send reset email
    const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const resetUrl = `${siteUrl}/reset-password?token=${token}`

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })

      await transporter.sendMail({
        from: `"Sunday Harmony" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Reset Your Password — Sunday Harmony',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
              Password Reset
            </h2>
            <p>Hi ${user.name},</p>
            <p>We received a request to reset your password. Click the button below to set a new one:</p>
            <div style="text-align:center;margin:30px 0">
              <a href="${resetUrl}" style="background:#c9a96e;color:#0a0a0f;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
                Reset Password
              </a>
            </div>
            <p style="font-size:13px;color:#666">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
            <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
              — Sunday Harmony
            </p>
          </div>
        `,
      })
    } else {
      console.log('SMTP not configured. Reset URL:', resetUrl)
    }

    return NextResponse.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
