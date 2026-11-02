const STAFF_ROLES = new Set([
  'admin',
  'credit_manager',
  'lead_procurement',
  'sales_closer',
  'client_relations',
])

export function isStaffRole(role?: string | null): boolean {
  return Boolean(role && STAFF_ROLES.has(role))
}

export function isMarketingStaffRole(role?: string | null): boolean {
  return role === 'lead_procurement' || role === 'sales_closer' || role === 'client_relations'
}
