import { requireAnyStaffSession } from '@/lib/stripe-admin-auth'
import { createAccountSettingsHandlers } from '@/lib/account-settings-handlers'

export const dynamic = 'force-dynamic'

const handlers = createAccountSettingsHandlers({
  requireSession: requireAnyStaffSession,
  rateLimitKey: 'admin-settings-password',
  routePath: '/api/admin/settings',
})

export const GET = handlers.GET
export const PUT = handlers.PUT
