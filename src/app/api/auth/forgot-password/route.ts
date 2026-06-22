import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getUserByEmail } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { escHtml, isEmailConfigured, sendEmail } from '@/lib/smtp-mail'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 requests per 15 minutes per IP
    const ip = getClientIp(req)
    const rlIp = rateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000)
    if (!rlIp.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const { email } = await req.json()
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const rlEmail = rateLimit(`forgot-password:email:${normalizedEmail}`, 3, 15 * 60 * 1000)
    if (!rlEmail.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
    const user = await getUserByEmail(normalizedEmail)

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true, message: 'If an account exists with that email, a verification code has been sent.' })
    }

    // Generate a 6-digit verification code
    const code = crypto.randomInt(100000, 999999).toString()
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes

    // Store code in user record (reuse reset_token fields)
    const { error: tokenError } = await getSupabase()
      .from('users')
      .update({ reset_token: code, reset_token_expires: expires })
      .eq('id', user.id)

    if (tokenError) {
      console.error('Failed to save reset code:', tokenError)
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }

    // Send verification code email
    if (isEmailConfigured()) {
      await sendEmail({
        to: normalizedEmail,
        subject: 'Your Password Reset Code — Sunday Harmony',
        html: `
          <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
              Password Reset Code
            </h2>
            <p>Hi ${escHtml(user.name || 'there')},</p>
            <p>We received a request to reset your password. Use the code below on the website to set a new password:</p>
            <div style="text-align:center;margin:30px 0">
              <div style="background:#f5f0e6;border:2px solid #c9a96e;border-radius:12px;padding:20px 40px;display:inline-block">
                <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#333">${code}</span>
              </div>
            </div>
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

    return NextResponse.json({ success: true, message: 'If an account exists with that email, a verification code has been sent.' })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
