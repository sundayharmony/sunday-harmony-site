import nodemailer from 'nodemailer'

/** True when Google Workspace / SMTP outbound email is configured. */
export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  )
}

/** @deprecated Use isEmailConfigured() */
export function isSmtpConfigured(): boolean {
  return isEmailConfigured()
}

export function getDefaultFromAddress(displayName = 'Sunday Harmony'): string {
  const from =
    process.env.SMTP_FROM_EMAIL?.trim() || process.env.SMTP_USER?.trim() || getAdminNotifyEmail()
  if (from.includes('<')) return from
  return `"${displayName}" <${from}>`
}

async function sendViaSmtp(opts: {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
    cid?: string
  }>
}): Promise<void> {
  const transporter = createEmailTransporter()
  await transporter.sendMail({
    from: opts.from || getDefaultFromAddress(),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
  })
}

/** Send HTML email via Google Workspace SMTP (or any configured SMTP). */
export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
    cid?: string
  }>
}): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('SMTP is not configured')
  }
  await sendViaSmtp(opts)
}

export function getSmtpPort(): number {
  const p = parseInt(process.env.SMTP_PORT || '587', 10)
  return Number.isFinite(p) && p > 0 ? p : 587
}

export function createEmailTransporter() {
  if (!isEmailConfigured()) {
    throw new Error('SMTP is not configured')
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port: getSmtpPort(),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASS!,
    },
  })
}

/**
 * Base origin for login / dashboard links in email (no trailing slash).
 * Prefer NEXTAUTH_URL, then NEXT_PUBLIC_SITE_URL.
 */
export function getPublicSiteUrl(): string {
  const raw = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').trim()
  const noTrail = raw.replace(/\/+$/, '')
  try {
    return new URL(noTrail || 'http://localhost:3000').origin
  } catch {
    return 'http://localhost:3000'
  }
}

/** Inbox for contact form + client message alerts to staff. */
export function getAdminNotifyEmail(): string {
  const n = process.env.NOTIFY_EMAIL?.trim()
  if (n && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n)) return n
  return 'sales@sundayharmony.com'
}

/** Strip control characters for safe use inside email Subject headers. */
export function sanitizeEmailSubjectPart(value: string, maxLen = 120): string {
  return value.replace(/[\r\n\u0000\u007F-\u009F]/g, ' ').trim().slice(0, maxLen)
}

export function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Fire-and-forget HTML mail; logs on failure. No-op if email is not configured. */
export function sendHtmlMailNonBlocking(opts: {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
  logLabel?: string
}): void {
  if (!isEmailConfigured()) return
  const label = opts.logLabel ?? 'mail'
  sendEmail(opts).catch((err: unknown) => console.error(`Failed to send mail (${label}):`, err))
}

/** Shared layout for client alerts that deep-link into the client dashboard. */
export function clientDashboardAlertEmailHtml(opts: {
  heading: string
  firstName: string
  bodyParagraphs: string[]
  dashboardPath: string
  buttonLabel?: string
  inlineImageCids?: Array<{ cid: string; alt: string }>
}): string {
  const site = getPublicSiteUrl()
  const path = opts.dashboardPath.startsWith('/') ? opts.dashboardPath : `/${opts.dashboardPath}`
  const href = `${site}${path}`
  const btn = opts.buttonLabel ?? 'View in Dashboard'
  const paras = opts.bodyParagraphs.map(p => `<p>${escHtml(p)}</p>`).join('')
  const imageBlocks = (opts.inlineImageCids || [])
    .map(
      (img) => `
      <div style="margin:16px 0;text-align:center">
        <img src="cid:${escHtml(img.cid)}" alt="${escHtml(img.alt)}" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e5e5e5" />
      </div>`
    )
    .join('')
  return `
    <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
        ${escHtml(opts.heading)}
      </h2>
      <p>Hi ${escHtml(opts.firstName)},</p>
      ${paras}
      ${imageBlocks}
      <div style="text-align:center;margin:24px 0">
        <a href="${escHtml(href)}" style="background:#c9a96e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
          ${escHtml(btn)}
        </a>
      </div>
      <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
        &mdash; Sunday Harmony
      </p>
    </div>
  `
}

/** Staff / internal alerts with a CTA into the admin app (path must start with /, may include query). */
export function staffPortalEmailHtml(opts: {
  heading: string
  bodyParagraphs: string[]
  pathWithQuery: string
  buttonLabel?: string
}): string {
  const site = getPublicSiteUrl()
  const path = opts.pathWithQuery.startsWith('/') ? opts.pathWithQuery : `/${opts.pathWithQuery}`
  const href = `${site}${path}`
  const btn = opts.buttonLabel ?? 'Open in Admin'
  const paras = opts.bodyParagraphs.map(p => `<p>${escHtml(p)}</p>`).join('')
  return `
    <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
        ${escHtml(opts.heading)}
      </h2>
      ${paras}
      <div style="text-align:center;margin:24px 0">
        <a href="${escHtml(href)}" style="background:#c9a96e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
          ${escHtml(btn)}
        </a>
      </div>
      <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
        &mdash; Sunday Harmony (internal)
      </p>
    </div>
  `
}
