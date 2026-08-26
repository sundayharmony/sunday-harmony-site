import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getUserByEmail } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { escHtml, getPublicSiteUrl, isEmailConfigured, sendEmail } from '@/lib/smtp-mail'
import { hashVerificationToken } from '@/lib/verification-token'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rlIp = await rateLimitDurable(`forgot-password:${ip}`, 5, 15 * 60 * 1000)
    if (!rlIp.allowed) return rateLimitResponse(rlIp.resetIn)

    const { email } = await req.json()
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const rlEmail = await rateLimitDurable(`forgot-password:email:${normalizedEmail}`, 3, 15 * 60 * 1000)
    if (!rlEmail.allowed) return rateLimitResponse(rlEmail.resetIn)

    const user = await getUserByEmail(normalizedEmail)

    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with that email, a verification code has been sent.',
      })
    }

    const code = crypto.randomInt(100000, 999999).toString()
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error: tokenError } = await getSupabase()
      .from('users')
      .update({ reset_token: hashVerificationToken(code), reset_token_expires: expires })
      .eq('id', user.id)

    if (tokenError) {
      console.error('Failed to save reset code:', tokenError)
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }

    if (isEmailConfigured()) {
      const siteUrl = getPublicSiteUrl()
      const resetUrl = `${siteUrl}/reset-password?email=${encodeURIComponent(user.email)}`
      await sendEmail({
        to: user.email,
        subject: 'Your Password Reset Code — Sunday Harmony',
        html: `
          <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
              Password Reset Code
            </h2>
            <p>Hi ${escHtml(user.name || 'there')},</p>
            <p>We received a request to reset your password. Enter this code on the <strong>Reset password</strong> page (not the two-factor / authenticator page):</p>
            <div style="text-align:center;margin:30px 0">
              <div style="background:#f5f0e6;border:2px solid #c9a96e;border-radius:12px;padding:20px 40px;display:inline-block">
                <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#333">${code}</span>
              </div>
            </div>
            <p style="text-align:center;margin:24px 0">
              <a href="${escHtml(resetUrl)}" style="background:#c9a96e;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
                Enter code &amp; new password
              </a>
            </p>
            <p style="font-size:13px;color:#666">This code expires in 15 minutes. If you didn&rsquo;t request this, you can safely ignore this email.</p>
            <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
              &mdash; Sunday Harmony
            </p>
          </div>
        `,
      })
    } else {
      console.error('Forgot password: email not configured')
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a verification code has been sent.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
