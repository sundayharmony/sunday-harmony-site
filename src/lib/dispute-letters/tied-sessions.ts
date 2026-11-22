/** Dispute history for one client file. Sessions without that application's id stay out. */
export function disputeSessionsTiedToApplication<T extends { application_uuid?: string | null }>(
  sessions: T[],
  applicationId: string
): T[] {
  const id = applicationId.trim()
  if (!id) return []
  return sessions.filter((session) => (session.application_uuid || '').trim() === id)
}
