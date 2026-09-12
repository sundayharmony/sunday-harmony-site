import { isStaffRole } from './staff-roles'
import { isUuid } from './uuid'

export type StaffSenderUser = { id: string; role?: string | null }

/** Prefer the session user id when it is a staff row; otherwise use the email match. */
export function pickStaffSenderId(input: {
  sessionUserId?: string | null
  userById?: StaffSenderUser | null
  userByEmail?: StaffSenderUser | null
}): string | null {
  const sessionUserId = input.sessionUserId?.trim() ?? ''
  if (
    isUuid(sessionUserId) &&
    input.userById &&
    input.userById.id === sessionUserId &&
    isStaffRole(input.userById.role)
  ) {
    return input.userById.id
  }
  if (input.userByEmail && isStaffRole(input.userByEmail.role)) {
    return input.userByEmail.id
  }
  return null
}
