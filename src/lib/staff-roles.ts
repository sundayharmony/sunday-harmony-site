export function isStaffRole(role?: string | null): boolean {
  return role === 'admin' || role === 'credit_manager'
}
