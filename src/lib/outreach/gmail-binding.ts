import { sendWorkspaceRawMime } from '@/lib/google-workspace'
import { buildOutreachMime } from './mime'
import { createDisabledProvider, createGmailOutreachProvider, type OutreachMailProvider, type OutreachSendPayload } from './provider'

export type RawMimeSender = (input: {
  rawMime: string
  threadId?: string | null
}) => Promise<{ id: string; threadId: string }>

export function createBoundGmailOutreachProvider(options?: {
  sendRawMime?: RawMimeSender
}): OutreachMailProvider {
  const sendRaw = options?.sendRawMime || sendWorkspaceRawMime
  return createGmailOutreachProvider({
    sendMime: async (payload: OutreachSendPayload) => {
      const mime = buildOutreachMime(payload)
      return sendRaw({ rawMime: mime })
    },
  })
}

export function resolveOutreachProvider(input: {
  liveSendAllowed: boolean
  sendRawMime?: RawMimeSender
}): OutreachMailProvider {
  if (!input.liveSendAllowed) return createDisabledProvider()
  return createBoundGmailOutreachProvider({ sendRawMime: input.sendRawMime })
}
