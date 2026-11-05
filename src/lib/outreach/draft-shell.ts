import { createHash } from 'node:crypto'
import {
  OUTREACH_COMPANY_NAME,
  OUTREACH_CTA_LABEL,
  OUTREACH_CTA_URL,
  OUTREACH_SENDER_EMAIL,
  OUTREACH_SIGNER_NAME,
  OUTREACH_TAGLINE,
} from './constants'

/** Unapproved reference HTML shell. Placeholders are replaced; never execute as code. */
export const DRAFT_HTML_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background:#f8f5f0;font-family:Montserrat,Arial,Helvetica,sans-serif;color:#0a0a0a;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{preheader}}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f5f0;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e2d9c8;">
          <tr>
            <td style="height:4px;background:#b8943f;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 36px 18px 36px;background:#0a0a0a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" width="44">
                    <div style="width:36px;height:36px;background:#b8943f;color:#0a0a0a;font-weight:700;text-align:center;line-height:36px;font-size:12px;letter-spacing:0.06em;font-family:Montserrat,Arial,sans-serif;">SH</div>
                  </td>
                  <td valign="middle" style="padding-left:12px;">
                    <div style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#b8943f;font-weight:600;font-family:Montserrat,Arial,sans-serif;">{{company}}</div>
                    <div style="font-size:11px;color:#cfc8bb;margin-top:4px;letter-spacing:0.04em;">{{tagline}}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 0 36px;">
              <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#b8943f;font-weight:600;">{{eyebrow}}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 36px 8px 36px;font-size:15px;line-height:1.65;color:#1c1b19;font-family:Montserrat,Arial,Helvetica,sans-serif;">
              {{body_html}}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 28px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#b8943f;border-radius:2px;">
                    <a href="{{cta_url}}" style="display:inline-block;padding:12px 22px;font-family:Montserrat,Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;text-decoration:none;">{{cta_label}}</a>
                  </td>
                </tr>
              </table>
              <div style="font-size:12px;color:#5d5a55;margin-top:12px;">{{cta_note}}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 28px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e2d9c8;">
                <tr>
                  <td style="padding-top:18px;">
                    <div style="font-size:14px;font-weight:600;color:#0a0a0a;">{{signer_name}}</div>
                    <div style="font-size:12px;color:#5d5a55;margin-top:2px;">{{company}}</div>
                    <div style="font-size:12px;color:#5d5a55;margin-top:2px;">{{tagline}}</div>
                    <div style="font-size:12px;color:#5d5a55;margin-top:8px;">
                      <a href="mailto:{{sender_email}}" style="color:#b8943f;text-decoration:none;">{{sender_email}}</a>
                      &nbsp;·&nbsp;
                      <a href="https://www.sundayharmony.com" style="color:#b8943f;text-decoration:none;">sundayharmony.com</a>
                    </div>
                    <div style="font-size:11px;color:#8a857d;margin-top:10px;line-height:1.5;">Not interested? <a href="{{unsubscribe_url}}" style="color:#8a857d;">Unsubscribe</a> or reply no thanks and we will not follow up.</div>
                    {{physical_address_html}}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f0ebe3;padding:14px 36px;border-top:1px solid #e2d9c8;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a857d;font-family:Montserrat,Arial,sans-serif;">{{company}}</td>
                  <td align="right" style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a857d;font-family:Montserrat,Arial,sans-serif;">{{tagline}}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

export const DRAFT_TEXT_SHELL = `Subject: {{subject}}
Preheader: {{preheader}}

{{body_text}}

{{cta_label}}: {{cta_url}}

Thanks,
{{signer_name}}
{{company}}
{{tagline}}
{{sender_email}} · sundayharmony.com
Not interested? Unsubscribe: {{unsubscribe_url}}
{{physical_address_text}}`

export const DRAFT_SUBJECT_TEMPLATE = '{business}: a note from Sunday Harmony'
export const DRAFT_PREHEADER_TEMPLATE = 'A short note and our company presentation.'

export function draftContentSha256(): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        html: DRAFT_HTML_SHELL,
        text: DRAFT_TEXT_SHELL,
        subject: DRAFT_SUBJECT_TEMPLATE,
        preheader: DRAFT_PREHEADER_TEMPLATE,
        signer: OUTREACH_SIGNER_NAME,
        company: OUTREACH_COMPANY_NAME,
        sender: OUTREACH_SENDER_EMAIL,
        ctaLabel: OUTREACH_CTA_LABEL,
        ctaUrl: OUTREACH_CTA_URL,
        tagline: OUTREACH_TAGLINE,
      })
    )
    .digest('hex')
}
