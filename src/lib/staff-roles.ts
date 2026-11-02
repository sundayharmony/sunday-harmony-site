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

/** Sales roles that can access Sales Kit: admin, lead_procurement, sales_closer */
export function isSalesRole(role?: string | null): boolean {
  return role === 'admin' || role === 'lead_procurement' || role === 'sales_closer'
}

/** Content/marketing roles that can access Content Kit: admin, client_relations */
export function isContentRole(role?: string | null): boolean {
  return role === 'admin' || role === 'client_relations'
}

/** Admin and credit managers confirm a code. Marketing roles sign in with a password only. */
export function roleRequiresMfa(role?: string | null): boolean {
  return role === 'admin' || role === 'credit_manager'
}
