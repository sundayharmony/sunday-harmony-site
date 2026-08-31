import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/db'
import { emailIlikePattern } from '@/lib/email-match'
import { nextSessionVersion } from '@/lib/session-version'
import { getSupabase } from '@/lib/supabase'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import {
  hashVerificationToken,
  verificationTokenMatches,
} from '@/lib/verification-token'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rlIp = await rateLimitDurable(`reset-password:${ip}`, 5, 15 * 60 * 1000)
    if (!rlIp.allowed) return rateLimitResponse(rlIp.resetIn)

    const { code, email, password } = await req.json()

    if (!code || !email || !password?.trim()) {
      return NextResponse.json(
        { error: 'Verification code, email, and new password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    if (password.length > 128) {
      return NextResponse.json({ error: 'Password is too long' }, { status: 400 })
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        {
          error:
            'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()
    const rlEmail = await rateLimitDurable(`reset-password:email:${normalizedEmail}`, 10, 15 * 60 * 1000)
    if (!rlEmail.allowed) return rateLimitResponse(rlEmail.resetIn)

    const codeKey = code.trim().replace(/\s/g, '')
    const rlCode = await rateLimitDurable(
      `reset-password:code:${normalizedEmail}:${codeKey}`,
      5,
      15 * 60 * 1000
    )
    if (!rlCode.allowed) return rateLimitResponse(rlCode.resetIn)

    const { data: user, error } = await getSupabase()
      .from('users')
      .select('id, reset_token, reset_token_expires, session_version')
      .ilike('email', emailIlikePattern(normalizedEmail))
      .single()

    if (error || !user || !verificationTokenMatches(user.reset_token, codeKey)) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    const hashedPassword = hashPassword(password)
    const passwordUpdate = {
      password: hashedPassword,
      reset_token: null,
      reset_token_expires: null,
      session_version: nextSessionVersion(
        typeof user.session_version === 'number' ? user.session_version : 0
      ),
    }
    let { error: updateError } = await getSupabase()
      .from('users')
      .update(passwordUpdate)
      .eq('id', user.id)

    if (updateError && /session_version/i.test(updateError.message || '')) {
      const withoutVersion = {
        password: passwordUpdate.password,
        reset_token: passwordUpdate.reset_token,
        reset_token_expires: passwordUpdate.reset_token_expires,
      }
      ;({ error: updateError } = await getSupabase()
        .from('users')
        .update(withoutVersion)
        .eq('id', user.id))
    }

    if (updateError) {
      console.error('Reset password update error:', updateError)
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Password has been reset successfully.' })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
