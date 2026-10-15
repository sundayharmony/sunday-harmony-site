import { escHtml, getPublicSiteUrl } from '@/lib/smtp-mail'

const INK = '#0a0a0a'
const GOLD = '#b8943f'
const MUTED = '#525252'
const CREAM = '#f4efe5'
const SOFT = '#f0ebe3'
const LINE = '#e8e0d0'

export function consultationCancelUrl(token: string): string {
  return `${getPublicSiteUrl()}/contact/cancel?token=${encodeURIComponent(token)}`
}

/** Confirmation or reminder in the public-site palette: cream, gold, black button. */
export function consultationEmailHtml(opts: {
  kind: 'confirmation' | 'reminder'
  audience: 'guest' | 'owner'
  greetingName: string
  whenLabel: string
  meetLink: string
  cancelUrl?: string
  business?: string
  guestEmail?: string
}): string {
  const greeting = opts.greetingName.trim() ? `Hi ${escHtml(opts.greetingName.trim())},` : 'Hello,'
  const headline = opts.kind === 'reminder' ? 'Your consultation is coming up.' : 'Your consultation is booked.'
  const italic = opts.kind === 'reminder' ? 'The Meet link is below.' : 'We will meet on Google Meet.'
  const intro =
    opts.audience === 'owner'
      ? `${escHtml(opts.greetingName || 'A guest')} booked a consultation${opts.business ? ` for ${escHtml(opts.business)}` : ''}.`
      : opts.kind === 'reminder'
        ? 'This is a reminder from Sunday Harmony. The time below is still on the calendar.'
        : 'Sunday Harmony has you on the calendar. Use the button below to join when it is time.'

  const chips = [opts.whenLabel, opts.audience === 'owner' && opts.guestEmail ? opts.guestEmail : 'Google Meet']
    .filter(Boolean)
    .map(
      (label) => `
        <td style="padding:0 6px 8px 0">
          <span style="display:inline-block;background:${SOFT};border:1px solid ${LINE};color:${INK};border-radius:999px;padding:8px 12px;font-size:12px;font-weight:600">
            ${escHtml(label)}
          </span>
        </td>`
    )
    .join('')

  const cancel =
    opts.audience === 'guest' && opts.cancelUrl
      ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:${MUTED}">Need to cancel? <a href="${escHtml(opts.cancelUrl)}" style="color:${GOLD};font-weight:700">Cancel this time</a> and the slot opens again.</p>`
      : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${headline}</title>
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
                Consultation
              </div>
              <h1 style="margin:18px 0 0;font-size:32px;line-height:1.1;font-weight:800;color:${INK}">
                ${headline}
              </h1>
              <p style="margin:8px 0 0;font-size:22px;line-height:1.2;font-weight:700;font-style:italic;color:${GOLD}">
                ${italic}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;font-size:15px;line-height:1.6;color:${MUTED}">
              <p style="margin:0 0 12px">${greeting}</p>
              <p style="margin:0">${intro}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>${chips}</tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 8px">
              <a href="${escHtml(opts.meetLink)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 22px;border-radius:8px">
                Join Google Meet
              </a>
              ${cancel}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;font-size:12px;line-height:1.5;color:${MUTED}">
              Sunday Harmony Consulting
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
