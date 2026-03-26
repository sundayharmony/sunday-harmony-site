import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 attempts per 15 minutes per IP
    const ip = getClientIp(req)
    const rl = rateLimit(`reset-password:${ip}`, 5, 15 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const { code, email, password } = await req.json()

    if (!code || !email || !password?.trim()) {
      return NextResponse.json({ error: 'Verification code, email, and new password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    if (password.length > 128) {
      return NextResponse.json({ error: 'Password is too long' }, { status: 400 })
    }

    // Require at least one uppercase, one lowercase, and one number
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' },
        { status: 400 }
      )
    }

    // Find user with this email and matching code
    const normalizedEmail = email.trim().toLowerCase()
    const { data: user, error } = await getSupabase()
      .from('users')
      .select('*')
      .ilike('email', normalizedEmail)
      .eq('reset_token', code.trim())
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    // Check expiry
    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 })
    }

    // Update password and clear token
    const hashedPassword = hashPassword(password)
    const { error: updateError } = await getSupabase()
      .from('users')
      .update({
        password: hashedPassword,
        reset_token: null,
        reset_token_expires: null,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Reset password update error:', updateError)
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Password has been reset. You can now sign in.' })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
