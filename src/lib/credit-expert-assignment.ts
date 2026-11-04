import { NextResponse } from 'next/server'
import { getCreditManagers } from '@/lib/db'

export type CreditStaffViewer = {
  role?: string | null
  userId?: string | null
}

export type CreditExpertOption = {
  id: string
  name: string
  email: string
}

export function viewerFromSession(session: {
  user?: { role?: string | null; id?: string | null }
}): CreditStaffViewer {
  return { role: session.user?.role, userId: session.user?.id }
}

export function creditExpertOwnsApplication(
  assignedSpecialist: string | null | undefined,
  expertUserId: string | null | undefined
): boolean {
  const assigned = (assignedSpecialist || '').trim()
  const expert = (expertUserId || '').trim()
  return Boolean(assigned && expert && assigned === expert)
}

/** Admins see every credit client. A credit expert sees only clients assigned to them. */
export function viewerMayAccessCreditApplication(
  application: { assigned_specialist?: string | null } | null | undefined,
  viewer: CreditStaffViewer
): boolean {
  if (!application) return false
  if (viewer.role === 'admin') return true
  if (viewer.role === 'credit_manager') {
    return creditExpertOwnsApplication(application.assigned_specialist, viewer.userId)
  }
  return false
}

export function filterCreditApplicationsForViewer<T extends { assigned_specialist?: string | null }>(
  applications: T[],
  viewer: CreditStaffViewer
): T[] {
  if (viewer.role !== 'credit_manager') return applications
  return applications.filter((application) =>
    creditExpertOwnsApplication(application.assigned_specialist, viewer.userId)
  )
}

export function creditApplicationAccessDenied(
  viewer: CreditStaffViewer,
  application: { assigned_specialist?: string | null } | null | undefined
): NextResponse | null {
  if (viewerMayAccessCreditApplication(application, viewer)) return null
  return NextResponse.json({ error: 'Application not found' }, { status: 404 })
}

export async function listCreditExpertOptions(): Promise<CreditExpertOption[]> {
  const managers = await getCreditManagers()
  return managers
    .map((user) => ({
      id: user.id,
      name: (user.name || '').trim() || user.email,
      email: user.email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function expertDisplayName(
  experts: Array<{ id: string; name: string }>,
  assignedSpecialist: string | null | undefined
): string {
  const id = (assignedSpecialist || '').trim()
  if (!id) return ''
  return experts.find((expert) => expert.id === id)?.name || ''
}

export async function assignedExpertIdForStaff(viewer: CreditStaffViewer): Promise<string | null> {
  if (viewer.role !== 'credit_manager') return null
  const id = (viewer.userId || '').trim()
  return id || null
}
