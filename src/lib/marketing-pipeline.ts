export const MARKETING_ROLES = ['lead_procurement', 'sales_closer', 'client_relations'] as const
export type MarketingRole = (typeof MARKETING_ROLES)[number]

export const PIPELINE_STAGES = [
  'researching',
  'ready_to_contact',
  'contacted',
  'responded',
  'meeting_scheduled',
  'proposal_sent',
  'negotiation',
  'won',
  'lost_nurture',
] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const STAGE_LABELS: Record<PipelineStage, string> = {
  researching: 'Researching',
  ready_to_contact: 'Ready to contact',
  contacted: 'Contacted',
  responded: 'Responded',
  meeting_scheduled: 'Meeting scheduled',
  proposal_sent: 'Proposal sent',
  negotiation: 'Negotiation / follow-up',
  won: 'Active',
  lost_nurture: 'Inactive',
}

export const PROSPECT_CATEGORIES = ['established', 'small', 'startup'] as const
export type ProspectCategory = (typeof PROSPECT_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<ProspectCategory, string> = {
  established: 'Established',
  small: 'Small',
  startup: 'Startup',
}

export const LEAD_SOURCES = [
  'website',
  'outbound',
  'in_person',
  'linkedin',
  'referral',
  'partner',
  'other',
  'inbound',
] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export const SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Website',
  outbound: 'Outbound',
  in_person: 'In person',
  linkedin: 'LinkedIn',
  referral: 'Referral',
  partner: 'Partner',
  other: 'Other',
  inbound: 'Website',
}


export const SCORE_FACTORS = [
  { key: 'weakness', label: 'Has an identifiable marketing weakness' },
  { key: 'operating', label: 'Has an active, operating business' },
  { key: 'need', label: 'Has a clear need for your services' },
  { key: 'decision_maker', label: 'Has a reachable owner or decision-maker' },
  { key: 'ability', label: 'Appears capable of investing in marketing' },
] as const

export type ScoreFactorKey = (typeof SCORE_FACTORS)[number]['key']
export type ScoreFactors = Record<ScoreFactorKey, number>

export const FIELD_PURPOSES = {
  business: 'Identify the prospect',
  industry: 'Categorize business',
  website: 'Review online presence',
  contact: 'Owner or decision-maker',
  email: 'Contact information',
  phone: 'Contact information',
  location: 'Geographic territory',
  category: 'Established, small, startup',
  opportunity: 'What you can improve',
  service: 'What you want to sell',
  score: '0–10',
  source: 'Where you found them',
  contactDate: 'Last outreach',
  followUp: 'Next action',
  stage: 'Current status',
  value: 'Potential project revenue',
  notes: 'Conversation history stays in Gmail. These notes stay internal.',
} as const

export type AdminNavItem = { href: string; label: string; icon: string }

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', icon: '\u{1F4C5}', label: 'Today' },
  { href: '/admin/pipeline', icon: '\u{1F4C8}', label: 'Pipeline' },
  { href: '/admin/clients', icon: '\u{1F91D}', label: 'Clients' },
  { href: '/admin/credit-funding', icon: '\u{1F4B3}', label: 'Credit & Funding' },
  { href: '/admin/referrals', icon: '\u{1F381}', label: 'Referrals' },
  { href: '/admin/sales-kit', icon: '\u{1F4BC}', label: 'Sales Kit' },
  { href: '/admin/content-kit', icon: '\u{1F4F1}', label: 'Content Kit' },
  { href: '/admin/partners', icon: '\u{1F465}', label: 'Partners' },
  { href: '/admin/messages', icon: '\u{1F4AC}', label: 'Messages' },
  { href: '/admin/settings', icon: '\u2699\uFE0F', label: 'Settings' },
]

const PROCUREMENT_STAGES = new Set<PipelineStage>(['researching', 'ready_to_contact', 'contacted'])
const SALES_STAGES = new Set<PipelineStage>([
  'ready_to_contact',
  'contacted',
  'responded',
  'meeting_scheduled',
  'proposal_sent',
  'negotiation',
  'won',
  'lost_nurture',
])

const STAGE_INDEX = new Map(PIPELINE_STAGES.map((stage, index) => [stage, index]))

export function isMarketingRole(role?: string | null): role is MarketingRole {
  return role === 'lead_procurement' || role === 'sales_closer' || role === 'client_relations'
}

export function isPipelineStage(value: unknown): value is PipelineStage {
  return typeof value === 'string' && STAGE_INDEX.has(value as PipelineStage)
}

export function isProspectCategory(value: unknown): value is ProspectCategory {
  return value === 'established' || value === 'small' || value === 'startup'
}

export function isLeadSource(value: unknown): value is LeadSource {
  return typeof value === 'string' && (LEAD_SOURCES as readonly string[]).includes(value)
}

export function emptyScoreFactors(): ScoreFactors {
  return { weakness: 0, operating: 0, need: 0, decision_maker: 0, ability: 0 }
}

export function clampFactor(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(2, Math.round(number)))
}

export function normalizeScoreFactors(input: unknown): ScoreFactors {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const factors = emptyScoreFactors()
  for (const factor of SCORE_FACTORS) {
    factors[factor.key] = clampFactor(source[factor.key])
  }
  return factors
}

export function scoreTotal(input: unknown): number {
  const factors = normalizeScoreFactors(input)
  return SCORE_FACTORS.reduce((sum, factor) => sum + factors[factor.key], 0)
}

export function scoreBand(total: number): 'high' | 'medium' | 'low' {
  if (total >= 8) return 'high'
  if (total >= 5) return 'medium'
  return 'low'
}

export function scoreBandLabel(total: number): string {
  const band = scoreBand(total)
  if (band === 'high') return 'High priority'
  if (band === 'medium') return 'Medium priority'
  return 'Low priority'
}

export function stageRequiresFollowUp(stage: PipelineStage): boolean {
  return stage !== 'won' && stage !== 'lost_nurture'
}

export function followUpError(stage: PipelineStage, followUpAt?: string | null): string | null {
  if (!stageRequiresFollowUp(stage)) return null
  if (!followUpAt || Number.isNaN(new Date(followUpAt).getTime())) {
    return 'Every active prospect needs a follow-up date.'
  }
  return null
}

export function marketingStatusForStage(stage: PipelineStage): string {
  switch (stage) {
    case 'researching':
      return 'new_lead'
    case 'ready_to_contact':
      return 'qualified'
    case 'contacted':
    case 'responded':
      return 'contacted'
    case 'meeting_scheduled':
    case 'proposal_sent':
    case 'negotiation':
      return 'consultation_scheduled'
    case 'won':
      return 'converted'
    case 'lost_nurture':
      return 'not_interested'
    default:
      return 'new_lead'
  }
}

export function legacyLeadStatusForStage(stage: PipelineStage): string {
  switch (stage) {
    case 'contacted':
    case 'responded':
    case 'meeting_scheduled':
      return 'contacted'
    case 'proposal_sent':
    case 'negotiation':
      return 'proposal'
    case 'won':
      return 'won'
    case 'lost_nurture':
      return 'lost'
    default:
      return 'new'
  }
}

export function stageFromLegacy(input: {
  marketingStatus?: string | null
  legacyStatus?: string | null
  source?: string | null
}): PipelineStage {
  const marketing = input.marketingStatus || ''
  const legacy = input.legacyStatus || ''
  if (marketing === 'converted' || legacy === 'won') return 'won'
  if (marketing === 'not_interested' || legacy === 'lost') return 'lost_nurture'
  if (legacy === 'proposal') return 'proposal_sent'
  if (marketing === 'consultation_scheduled') return 'meeting_scheduled'
  if (marketing === 'qualified') return 'ready_to_contact'
  if (marketing === 'contacted' || legacy === 'contacted') return 'contacted'
  if (input.source === 'inbound' || input.source === 'website') return 'responded'
  return 'researching'
}

const EARLY_FOR_MEETING = new Set<PipelineStage>([
  'researching',
  'ready_to_contact',
  'contacted',
  'responded',
  'meeting_scheduled',
])

/** A booked consultation advances early pipeline rows and leaves later deals alone. */
export function stageAfterConsultation(current?: string | null): PipelineStage | null {
  if (!current) return 'meeting_scheduled'
  if (!isPipelineStage(current)) return 'meeting_scheduled'
  if (!EARLY_FOR_MEETING.has(current)) return null
  return 'meeting_scheduled'
}

export function stageAfterOutboundEmail(current: PipelineStage): PipelineStage {
  if (current === 'researching' || current === 'ready_to_contact') return 'contacted'
  return current
}

export function stageAfterProspectReply(current: PipelineStage): PipelineStage | null {
  const index = STAGE_INDEX.get(current) ?? 0
  const responded = STAGE_INDEX.get('responded') ?? 0
  if (index < responded) return 'responded'
  return null
}

const SALES_INTAKE = new Set<PipelineStage>(['ready_to_contact', 'contacted'])

/** Procurement stops seeing a lead after the sales handoff. Sales sees intake rows only after that handoff. */
export function roleCanSeeProspect(
  role: string | null | undefined,
  prospect: { stage: PipelineStage; handedToSalesAt?: string | null; handedToRelationsAt?: string | null }
): boolean {
  if (role === 'admin') return true
  if (role === 'lead_procurement') {
    return PROCUREMENT_STAGES.has(prospect.stage) && !prospect.handedToSalesAt
  }
  if (role === 'sales_closer') {
    if (!SALES_STAGES.has(prospect.stage)) return false
    if (SALES_INTAKE.has(prospect.stage)) return Boolean(prospect.handedToSalesAt)
    return true
  }
  if (role === 'client_relations') {
    return prospect.stage === 'won' && Boolean(prospect.handedToRelationsAt)
  }
  return false
}

export function stagesVisibleToRole(role?: string | null): PipelineStage[] | 'all' {
  if (role === 'admin') return 'all'
  if (role === 'lead_procurement') return [...PROCUREMENT_STAGES]
  if (role === 'sales_closer') return [...SALES_STAGES]
  return []
}

export type BoardLane = {
  id: string
  title: string
  detail: string
  stages: PipelineStage[]
}

const PROCUREMENT_LANE_STAGES: PipelineStage[] = ['researching', 'ready_to_contact', 'contacted']
const SALES_WORK_STAGES: PipelineStage[] = [
  'responded',
  'meeting_scheduled',
  'proposal_sent',
  'negotiation',
  'lost_nurture',
]

/** Columns on the board. Edit rights stay on stagesVisibleToRole, which is empty for client relations. */
export function boardLanes(role?: string | null): BoardLane[] {
  if (role === 'lead_procurement') {
    return [{
      id: 'procurement',
      title: 'Lead procurement',
      detail: 'Research the business, make first contact, and hand a qualified lead to sales.',
      stages: [...PROCUREMENT_LANE_STAGES],
    }]
  }
  if (role === 'sales_closer') {
    return [
      {
        id: 'handed-to-sales',
        title: 'Handed to sales',
        detail: 'Qualified leads procurement has passed to you.',
        stages: ['ready_to_contact', 'contacted'],
      },
      {
        id: 'sales',
        title: 'Sales',
        detail: 'Replies, meetings, proposals, and leads that go Inactive.',
        stages: [...SALES_WORK_STAGES],
      },
      {
        id: 'active',
        title: 'Active',
        detail: 'Bill the client from Today, then hand the file to client relations.',
        stages: ['won'],
      },
    ]
  }
  if (role === 'client_relations') {
    return [{
      id: 'client-relations',
      title: 'Client relations',
      detail: 'Welcome the active client and start onboarding.',
      stages: ['won'],
    }]
  }
  return [
    {
      id: 'procurement',
      title: 'Lead procurement',
      detail: 'Research, first contact, and the handoff to sales.',
      stages: [...PROCUREMENT_LANE_STAGES],
    },
    {
      id: 'sales',
      title: 'Sales',
      detail: 'Replies, meetings, proposals, and inactive leads.',
      stages: [...SALES_WORK_STAGES],
    },
    {
      id: 'client-relations',
      title: 'Client relations',
      detail: 'Active clients after the sale.',
      stages: ['won'],
    },
  ]
}

export function roleCanEditStage(role: string | null | undefined, stage: PipelineStage): boolean {
  if (role === 'admin') return true
  const visible = stagesVisibleToRole(role)
  return visible !== 'all' && visible.includes(stage)
}

export function canMoveStage(role: string | null | undefined, from: PipelineStage, to: PipelineStage): boolean {
  if (from === to) return true
  if (role === 'admin') return true
  if (role === 'lead_procurement') return PROCUREMENT_STAGES.has(from) && PROCUREMENT_STAGES.has(to)
  if (role === 'sales_closer') return SALES_STAGES.has(from) && SALES_STAGES.has(to)
  return false
}

export function navForRole(role?: string | null): AdminNavItem[] {
  if (role === 'credit_manager') {
    return ADMIN_NAV.filter((item) =>
      item.href === '/admin/credit-funding' ||
      item.href === '/admin/messages' ||
      item.href === '/admin/settings'
    )
  }
  if (role === 'lead_procurement') {
    return ADMIN_NAV.filter((item) =>
      item.href === '/admin' ||
      item.href === '/admin/pipeline' ||
      item.href === '/admin/sales-kit' ||
      item.href === '/admin/messages' ||
      item.href === '/admin/settings'
    )
  }
  if (role === 'sales_closer') {
    return ADMIN_NAV.filter((item) =>
      item.href === '/admin'
      || item.href === '/admin/pipeline'
      || item.href === '/admin/sales-kit'
      || item.href === '/admin/messages'
      || item.href === '/admin/settings'
    )
  }
  if (role === 'client_relations') {
    return ADMIN_NAV.filter((item) =>
      item.href === '/admin' ||
      item.href === '/admin/pipeline' ||
      item.href === '/admin/clients' ||
      item.href === '/admin/content-kit' ||
      item.href === '/admin/messages' ||
      item.href === '/admin/settings'
    )
  }
  if (role === 'admin') return ADMIN_NAV
  return []
}

export function homeForRole(role?: string | null): string {
  if (role === 'credit_manager') return '/admin/credit-funding'
  if (role === 'client') return '/dashboard'
  if (role === 'partner') return '/partner'
  if (role === 'admin' || isMarketingRole(role)) return '/admin'
  return '/'
}

export function marketingRoleAllowedPath(role: string, path: string): boolean {
  if (
    path === '/admin' ||
    path === '/admin/settings' ||
    path.startsWith('/admin/settings/') ||
    path === '/admin/messages' ||
    path.startsWith('/admin/messages/')
  ) return true
  if (role === 'lead_procurement' || role === 'sales_closer') {
    return (
      path === '/admin/pipeline' ||
      path.startsWith('/admin/pipeline/') ||
      path === '/admin/sales-kit' ||
      path.startsWith('/admin/sales-kit/')
    )
  }
  if (role === 'client_relations') {
    return (
      path === '/admin/pipeline' ||
      path === '/admin/clients' ||
      path.startsWith('/admin/clients/') ||
      path === '/admin/content-kit' ||
      path.startsWith('/admin/content-kit/')
    )
  }
  return false
}

/** Sales closers and admins can schedule meetings and send agreements from a prospect file. */
export function roleMayRunSalesActions(role?: string | null): boolean {
  return role === 'admin' || role === 'sales_closer'
}

export type ProcurementChecklistInput = {
  businessName?: string | null
  decisionMaker?: string | null
  email?: string | null
  phone?: string | null
  marketingOpportunity?: string | null
  leadSource?: string | null
  notes?: string | null
  score?: number | null
}

export function procurementHandoffGaps(input: ProcurementChecklistInput): string[] {
  const gaps: string[] = []
  if (!(input.businessName || '').trim()) gaps.push('Business name')
  if (!(input.decisionMaker || '').trim()) gaps.push('Decision-maker')
  if (!(input.email || '').trim() && !(input.phone || '').trim()) gaps.push('Email or phone')
  if (!(input.marketingOpportunity || '').trim()) gaps.push('Marketing opportunity')
  if (!(input.leadSource || '').trim()) gaps.push('Lead source')
  if (!(input.notes || '').trim()) gaps.push('Research notes')
  if (input.score == null || Number.isNaN(input.score)) gaps.push('Prospect score')
  return gaps
}

export type SalesChecklistInput = {
  servicesPurchased?: string | null
  scope?: string | null
  deliverables?: string | null
  deadline?: string | null
  promises?: string | null
  expectations?: string | null
  agreementSigned?: boolean
  paymentStatus?: string | null
  proposalUrl?: string | null
}

export function salesHandoffGaps(input: SalesChecklistInput): string[] {
  const gaps: string[] = []
  if (!(input.servicesPurchased || '').trim()) gaps.push('Services purchased')
  if (!(input.scope || '').trim()) gaps.push('Scope')
  if (!(input.deliverables || '').trim()) gaps.push('Deliverables')
  if (!(input.deadline || '').trim()) gaps.push('Deadline')
  if (!(input.promises || '').trim()) gaps.push('Promises made')
  if (!(input.expectations || '').trim()) gaps.push('Client expectations')
  if (!input.agreementSigned) gaps.push('Agreement marked signed')
  if (!(input.paymentStatus || '').trim()) gaps.push('Payment status')
  if (!(input.proposalUrl || '').trim()) gaps.push('Proposal Doc')
  return gaps
}

export function canHandOffToSales(role: string | null | undefined, stage: PipelineStage): boolean {
  if (role !== 'admin' && role !== 'lead_procurement') return false
  return stage === 'ready_to_contact' || stage === 'contacted'
}

export function canHandOffToRelations(role: string | null | undefined, stage: PipelineStage): boolean {
  if (role !== 'admin' && role !== 'sales_closer') return false
  return stage === 'won'
}

/** A closer bills an Active marketing client linked to a deal they can still see. */
export function closerMayBillProspect(
  role: string | null | undefined,
  prospect: { stage: PipelineStage; handedToSalesAt?: string | null; handedToRelationsAt?: string | null } | null,
  marketingClient: boolean
): boolean {
  if (role !== 'sales_closer' || !prospect || !marketingClient) return false
  if (prospect.stage !== 'won') return false
  return roleCanSeeProspect(role, prospect)
}

export type OnboardingChecklist = {
  welcomed: boolean
  assets: boolean
  access: boolean
  requirements: boolean
  expectations: boolean
}

export function emptyOnboarding(): OnboardingChecklist {
  return { welcomed: false, assets: false, access: false, requirements: false, expectations: false }
}

export function normalizeOnboarding(input: unknown): OnboardingChecklist {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const base = emptyOnboarding()
  for (const key of Object.keys(base) as (keyof OnboardingChecklist)[]) {
    base[key] = Boolean(source[key])
  }
  return base
}

export function onboardingComplete(input: unknown): boolean {
  const checklist = normalizeOnboarding(input)
  return Object.values(checklist).every(Boolean)
}

export type MetricRow = { label: string; value: string }

export type MetricProspect = {
  stage: PipelineStage
  hasContact: boolean
  handedToSales: boolean
  estimatedValue?: number | null
}

const CONTACTED_OR_LATER = new Set<PipelineStage>([
  'contacted',
  'responded',
  'meeting_scheduled',
  'proposal_sent',
  'negotiation',
  'won',
  'lost_nurture',
])

const MEETING_OR_LATER = new Set<PipelineStage>([
  'meeting_scheduled',
  'proposal_sent',
  'negotiation',
  'won',
])

const PROPOSAL_OR_LATER = new Set<PipelineStage>(['proposal_sent', 'negotiation', 'won'])

function percent(part: number, whole: number): string {
  if (whole <= 0) return '0%'
  return `${Math.round((part / whole) * 100)}%`
}

export function procurementMetrics(rows: MetricProspect[]): MetricRow[] {
  const qualified = rows.filter((row) => row.handedToSales).length
  const withContact = rows.filter((row) => row.hasContact).length
  const contacted = rows.filter((row) => CONTACTED_OR_LATER.has(row.stage)).length
  const meetings = rows.filter((row) => MEETING_OR_LATER.has(row.stage)).length
  return [
    { label: 'Qualified leads delivered', value: String(qualified) },
    { label: 'Contact info on file', value: `${withContact} of ${rows.length}` },
    { label: 'Lead-to-meeting rate', value: percent(meetings, contacted) },
  ]
}

export function salesMetrics(rows: MetricProspect[]): MetricRow[] {
  const meetings = rows.filter((row) => MEETING_OR_LATER.has(row.stage)).length
  const proposals = rows.filter((row) => PROPOSAL_OR_LATER.has(row.stage)).length
  const won = rows.filter((row) => row.stage === 'won')
  const revenue = won.reduce((sum, row) => sum + (Number(row.estimatedValue) || 0), 0)
  return [
    { label: 'Meetings', value: String(meetings) },
    { label: 'Proposals', value: String(proposals) },
    { label: 'Proposal conversion', value: percent(won.length, proposals) },
    {
      label: 'Recorded revenue',
      value: revenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
    },
  ]
}

export function relationsMetrics(input: { onTime: number; due: number; openOnboarding: number }): MetricRow[] {
  return [
    { label: 'On-time milestones', value: `${input.onTime} of ${input.due}` },
    { label: 'Onboarding still open', value: String(input.openOnboarding) },
  ]
}

export function visibleStages(role: string | null | undefined, stages: PipelineStage[]): PipelineStage[] {
  const allowed = stagesVisibleToRole(role)
  if (allowed === 'all') return stages
  return stages.filter((stage) => allowed.includes(stage))
}
