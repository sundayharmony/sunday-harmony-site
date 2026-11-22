import { isImageAttachment, type PublicAttachment } from '@/lib/portal-message-mail'

export function MessageAttachments({
  messageId,
  attachments,
  basePath,
}: {
  messageId: string
  attachments?: PublicAttachment[]
  basePath: string
}) {
  if (!attachments?.length) return null
  return (
    <div className="mt-2 space-y-2">
      {attachments.map((attachment) => {
        const href = `${basePath}/${encodeURIComponent(messageId)}/files/${encodeURIComponent(attachment.id)}`
        if (isImageAttachment(attachment.type, attachment.name)) {
          return (
            <a key={attachment.id} href={href} className="block min-w-0">
              {/* Session cookie stays on this origin; next/image would fetch the file without the viewer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={href} alt={attachment.name} className="max-h-48 max-w-full rounded-lg border border-brand-border" />
              <span className="mt-1 block text-xs text-brand-muted break-all">{attachment.name}</span>
            </a>
          )
        }
        return (
          <a key={attachment.id} href={href} className="block text-sm font-semibold text-accent break-all hover:underline">
            {attachment.name}
          </a>
        )
      })}
    </div>
  )
}
