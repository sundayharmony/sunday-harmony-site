import { payloadSha256 } from './draft'
import type { OutreachStore } from './store'
import type { QueueItem } from './types'
import { createUnsubscribeToken, hashUnsubscribeToken, unsubscribeUrl } from './unsubscribe'

const PREVIEW_DISABLED = '/unsubscribe/preview-disabled'

export function htmlHasRealUnsubscribe(html: string): boolean {
  return /\/unsubscribe\/[A-Za-z0-9_-]{16,}/.test(html) && !html.includes(PREVIEW_DISABLED)
}

export function extractUnsubscribeUrl(html: string): string | null {
  const match = html.match(/https?:\/\/[^\s"'<>]+\/unsubscribe\/[A-Za-z0-9_-]{16,}/)
  return match ? match[0] : null
}

export async function ensureQueueUnsubscribeUrl(
  store: OutreachStore,
  item: QueueItem
): Promise<{ url: string; item: QueueItem; minted: boolean }> {
  const existing = await store.findUnsubscribeTokenByQueueId(item.id)
  if (existing && htmlHasRealUnsubscribe(item.htmlBody)) {
    const tokenFromHtml = item.htmlBody.match(/\/unsubscribe\/([A-Za-z0-9_-]{16,})/)
    if (tokenFromHtml) {
      return { url: unsubscribeUrl(tokenFromHtml[1]), item, minted: false }
    }
  }
  const token = createUnsubscribeToken()
  const url = unsubscribeUrl(token)
  await store.putUnsubscribeToken({
    tokenHash: hashUnsubscribeToken(token),
    emailNormalized: item.emailNormalized,
    leadId: item.leadId,
    queueId: item.id,
  })
  const htmlBody = item.htmlBody.includes(PREVIEW_DISABLED)
    ? item.htmlBody.split(PREVIEW_DISABLED).join(`/unsubscribe/${token}`)
    : item.htmlBody.includes('{{unsubscribe_url}}')
      ? item.htmlBody.replaceAll('{{unsubscribe_url}}', url)
      : item.htmlBody.replace(/\/unsubscribe\/[A-Za-z0-9_-]+/g, `/unsubscribe/${token}`)
  const textBody = item.textBody.includes(PREVIEW_DISABLED)
    ? item.textBody.split(PREVIEW_DISABLED).join(`/unsubscribe/${token}`)
    : item.textBody.replace(/\/unsubscribe\/[A-Za-z0-9_-]+/g, `/unsubscribe/${token}`)
  const next: QueueItem = {
    ...item,
    htmlBody,
    textBody,
    payloadSha256: payloadSha256({
      subject: item.subject,
      html: htmlBody,
      text: textBody,
      to: item.emailNormalized,
    }),
  }
  return { url, item: next, minted: true }
}
