import crypto from 'crypto'
import { getSupabase } from '@/lib/supabase'
import { escHtml, getPublicSiteUrl, isEmailConfigured, sendEmail } from '@/lib/smtp-mail'
import { hashVerificationToken } from '@/lib/verification-token'

const SETUP_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function generateTempPassword(): string {
  return `${crypto.randomBytes(12).toString('base64url')}A1!`
}

export function generateSetupCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export async function storeCreditManagerSetupCode(userId: string, setupCode: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('users')
    .update({
      reset_token: hashVerificationToken(setupCode),
      reset_token_expires: new Date(Date.now() + SETUP_CODE_TTL_MS).toISOString(),
    })
    .eq('id', userId)

  if (error) {
    console.error('storeCreditManagerSetupCode error:', error)
    return false
  }
  return true
}

export async function sendCreditManagerSetupEmail(params: {
  to: string
  name: string
  setupCode: string
}): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('Email is not configured on the server')
  }

  const siteUrl = getPublicSiteUrl()
  const email = params.to.trim().toLowerCase()
  const resetUrl = `${siteUrl}/reset-password?email=${encodeURIComponent(email)}`
  const firstName = escHtml((params.name || 'there').split(' ')[0])

  await sendEmail({
    to: email,
    subject: 'Set Up Your Sunday Harmony Credit Manager Access',
    html: `
      <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
          Credit Manager Access
        </h2>
        <p>Hi ${firstName},</p>
        <p>Your Sunday Harmony <strong>Credit Manager</strong> account is ready. Use the one-time setup code below to choose your password and sign in.</p>
        <div style="text-align:center;margin:30px 0">
          <div style="background:#f5f0e6;border:2px solid #c9a96e;border-radius:12px;padding:20px 40px;display:inline-block">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#333">${escHtml(params.setupCode)}</span>
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
        <p style="color:#525252;line-height:1.6;font-size:14px">After setup you can use the <strong>Credit Intelligence</strong> panel and <strong>team messaging</strong> in the admin portal.</p>
        <p style="font-size:13px;color:#666">This code expires in 7 days. If you did not expect this email, contact Sunday Harmony support.</p>
        <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
          &mdash; Sunday Harmony
        </p>
      </div>
    `,
  })
}

export async function issueAndSendCreditManagerSetupEmail(user: {
  id: string
  email: string
  name: string
}): Promise<{ emailSent: boolean }> {
  const setupCode = generateSetupCode()
  const stored = await storeCreditManagerSetupCode(user.id, setupCode)
  if (!stored) {
    throw new Error('Failed to store setup code')
  }
  await sendCreditManagerSetupEmail({
    to: user.email,
    name: user.name,
    setupCode,
  })
  return { emailSent: true }
}
