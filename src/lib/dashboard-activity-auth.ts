export type DashboardActivityAccess =
  | { ok: true; clientId: string }
  | { ok: false; status: 401 | 403; error: string }

/** Clients must have a clientId; admins use /api/admin/activity instead. */
export function resolveClientActivityAccess(session: {
  user?: { role?: string; clientId?: string } | null
} | null): DashboardActivityAccess {
  if (!session?.user) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  const role = session.user.role
  const clientId = session.user.clientId

  if (role === 'admin') {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  if (role !== 'client') {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  if (!clientId) {
    return { ok: false, status: 403, error: 'Client account is not fully provisioned' }
  }

  return { ok: true, clientId }
}
