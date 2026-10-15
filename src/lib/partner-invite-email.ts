import { escHtml, getPublicSiteUrl } from '@/lib/smtp-mail'

const INK = '#0a0a0a'
const GOLD = '#b8943f'
const MUTED = '#525252'
const CREAM = '#f4efe5'
const SOFT = '#f0ebe3'
const LINE = '#e8e0d0'

export function partnerSignupUrl(): string {
  return `${getPublicSiteUrl()}/partners/signup`
}

/** Invitation email that follows the public site: cream ground, gold accent, black button. */
export function partnerSignupInviteEmailHtml(opts: { firstName?: string }): string {
  const href = partnerSignupUrl()
  const greeting = opts.firstName?.trim()
    ? `Hi ${escHtml(opts.firstName.trim())},`
    : 'Hello,'
  const chips = [
    'Your own referral link',
    'Progress on the people you refer',
    'The link turns on after we approve you',
  ]
    .map(
      (label) => `
        <td style="padding:0 6px 8px 0">
          <span style="display:inline-block;background:${SOFT};border:1px solid ${LINE};color:${INK};border-radius:999px;padding:8px 12px;font-size:12px;font-weight:600">
            ${escHtml(label)}
          </span>
        </td>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign up as a Sunday Harmony partner</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};font-family:Montserrat,'Helvetica Neue',Arial,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:24px;overflow:hidden">
          <tr>
            <td style="height:6px;background:${GOLD};font-size:0;line-height:0">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:36px 32px 8px">
              <div style="display:inline-block;background:${SOFT};border:1px solid ${LINE};color:${GOLD};border-radius:999px;padding:6px 12px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">
                Partnership
              </div>
              <h1 style="margin:18px 0 0;font-size:32px;line-height:1.1;font-weight:800;color:${INK}">
                Refer the people who need credit help.
              </h1>
              <p style="margin:8px 0 0;font-size:22px;line-height:1.2;font-weight:700;font-style:italic;color:${GOLD}">
                See their progress from your dashboard.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;font-size:15px;line-height:1.6;color:${MUTED}">
              <p style="margin:0 0 12px">${greeting}</p>
              <p style="margin:0">
                Sunday Harmony is inviting you to a partner account. Mortgage, auto, and real estate professionals use it to share a personal credit link and follow the people they refer. You are not signing up as a credit client.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>${chips}</tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px">
              <a href="${escHtml(href)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 22px;border-radius:8px">
                Sign up as a partner
              </a>
              <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#a3a3a3">
                Or open this link:<br />
                <a href="${escHtml(href)}" style="color:${GOLD};word-break:break-all">${escHtml(href)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid ${LINE};font-size:12px;color:#a3a3a3">
              Sunday Harmony Consulting · Brand, strategy, and systems.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
