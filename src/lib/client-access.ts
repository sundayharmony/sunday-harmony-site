export function resolveClientAccess(
  session: { user?: { role?: string; clientId?: string } } | null
):
  | { ok: true; clientId: string }
  | { ok: false; status: 401 | 403; error: string } {
  if (!session?.user) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  if (session.user.role !== 'client') {
    return { ok: false, status: 403, error: 'Forbidden' }
  }
  if (!session.user.clientId) {
    return {
      ok: false,
      status: 403,
      error: 'Client account is not fully provisioned',
    }
  }
  return { ok: true, clientId: session.user.clientId }
}
