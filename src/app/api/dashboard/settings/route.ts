import { requireClientSession } from '@/lib/client-auth'
import { createAccountSettingsHandlers } from '@/lib/account-settings-handlers'

export const dynamic = 'force-dynamic'

const handlers = createAccountSettingsHandlers({
  requireSession: requireClientSession,
  rateLimitKey: 'settings-password',
  routePath: '/api/dashboard/settings',
})

export const GET = handlers.GET
export const PUT = handlers.PUT
