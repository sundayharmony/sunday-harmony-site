export const MARKETING_ROLES = ['lead_procurement', 'sales_closer', 'client_relations'] as const
export type MarketingRole = (typeof MARKETING_ROLES)[number]

export const PIPELINE_STAGES = [
  'uncontacted',
  'emailed',
  'contacted',
  'offer_made',
  'won',
  'lost_nurture',
] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

/** Stages staff can pick. Stored rows still use the older database values. */
export const STAFF_PIPELINE_STAGES = PIPELINE_STAGES

export type StaffPipelineStage = PipelineStage

export const STAGE_LABELS: Record<PipelineStage, string> = {
  uncontacted: 'Uncontacted',
  emailed: 'Emailed',
  contacted: 'Contacted',
  offer_made: 'Offer made',
  won: 'Active client',
  lost_nurture: 'Inactive',
}

/**
 * The leads.pipeline_stage check already allows these values.
 * Uncontacted is ready_to_contact, Emailed is responded, a call with no
 * answer is negotiation, and Offer made is proposal_sent.
 */
const STORED_PIPELINE_STAGE: Record<PipelineStage, string> = {
  uncontacted: 'ready_to_contact',
  emailed: 'responded',
  contacted: 'negotiation',
  offer_made: 'proposal_sent',
  won: 'won',
  lost_nurture: 'lost_nurture',
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
  'ads',
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
  ads: 'Ads',
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
  followUp: 'Optional reminder. Set only when you actually need one.',
  stage: 'Current status. Uncontacted, then Emailed, then Contacted if the call was not answered, then Offer made, then Active client.',
  value: 'Potential project revenue',
  notes: 'Conversation history stays in Gmail. These notes stay internal.',
} as const

export type AdminNavItem = { href: string; label: string; icon: string }

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', icon: '\u{1F4C5}', label: 'Today' },
  { href: '/admin/calendar', icon: '\u{1F5D3}', label: 'Calendar' },
  { href: '/admin/marketing', icon: '\u{1F4C8}', label: 'Marketing' },
  { href: '/admin/credit-funding', icon: '\u{1F4B3}', label: 'Credit & Funding' },
  { href: '/admin/referrals', icon: '\u{1F381}', label: 'Referrals' },
  { href: '/admin/case-study', icon: '\u{1F5BC}\uFE0F', label: 'Case Study' },
  { href: '/admin/todos', icon: '\u2705', label: 'Todos' },
  { href: '/admin/sales-kit', icon: '\u{1F4BC}', label: 'Sales Kit' },
  { href: '/admin/training', icon: '\u{1F4DA}', label: 'Training' },
  { href: '/admin/content-kit', icon: '\u{1F4F1}', label: 'Content Kit' },
  { href: '/admin/messages', icon: '\u{1F4AC}', label: 'Messages' },
  { href: '/admin/settings', icon: '\u2699\uFE0F', label: 'Settings' },
]

const PROCUREMENT_STAGES = new Set<PipelineStage>(['uncontacted', 'emailed'])
const SALES_STAGES = new Set<PipelineStage>([
  'uncontacted',
  'emailed',
  'contacted',
  'offer_made',
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

export function isStaffPipelineStage(value: unknown): value is StaffPipelineStage {
  return typeof value === 'string' && (STAFF_PIPELINE_STAGES as readonly string[]).includes(value)
}

/** Staff stages are the live stages. Older stored values are translated first. */
export function staffPipelineStage(stage: PipelineStage): StaffPipelineStage {
  return stage
}

export function stageToStorage(stage: PipelineStage): string {
  return STORED_PIPELINE_STAGE[stage]
}

/** Read a stored pipeline_stage, including values saved before this stage list. */
export function stageFromStorage(value: unknown): PipelineStage {
  switch (value) {
    case 'uncontacted':
    case 'researching':
    case 'ready_to_contact':
      return 'uncontacted'
    case 'emailed':
    case 'responded':
    case 'contacted':
      return 'emailed'
    case 'negotiation':
      return 'contacted'
    case 'offer_made':
    case 'meeting_scheduled':
    case 'proposal_sent':
      return 'offer_made'
    case 'won':
      return 'won'
    case 'lost_nurture':
      return 'lost_nurture'
    default:
      return 'uncontacted'
  }
}

export function staffStagesVisibleToRole(role?: string | null): StaffPipelineStage[] {
  const allowed = stagesVisibleToRole(role)
  const staff = [...STAFF_PIPELINE_STAGES]
  if (allowed === 'all') return staff
  return staff.filter((stage) => allowed.includes(stage))
}

export function staffStageChoices(role: string | null | undefined, current: PipelineStage): StaffPipelineStage[] {
  const displayed = staffPipelineStage(current)
  return staffStagesVisibleToRole(role).filter(
    (stage) => stage === displayed || canMoveStage(role, current, stage) || canMoveStage(role, displayed, stage)
  )
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

export function stageRequiresFollowUp(_stage: PipelineStage): boolean {
  return false
}

export function followUpError(_stage: PipelineStage, followUpAt?: string | null): string | null {
  if (!followUpAt) return null
  if (Number.isNaN(new Date(followUpAt).getTime())) return 'Follow-up must be a valid date.'
  return null
}

export function marketingStatusForStage(stage: PipelineStage): string {
  switch (stage) {
    case 'uncontacted':
      return 'qualified'
    case 'emailed':
    case 'contacted':
      return 'contacted'
    case 'offer_made':
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
    case 'emailed':
    case 'contacted':
      return 'contacted'
    case 'offer_made':
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
  if (legacy === 'proposal' || marketing === 'consultation_scheduled') return 'offer_made'
  if (marketing === 'contacted' || legacy === 'contacted') return 'emailed'
  return 'uncontacted'
}

/** Booking a meeting keeps the current stage. The follow-up date holds the appointment. */
export function stageAfterConsultation(_current?: string | null): PipelineStage | null {
  return null
}

export function stageAfterOutboundEmail(current: PipelineStage): PipelineStage {
  if (current === 'uncontacted') return 'emailed'
  return current
}

export function stageAfterProspectReply(current: PipelineStage): PipelineStage | null {
  if (current === 'uncontacted') return 'emailed'
  return null
}

/** Procurement stops seeing a lead after the sales handoff. Sales can open every Uncontacted lead. */
export function roleCanSeeProspect(
  role: string | null | undefined,
  prospect: {
    stage: PipelineStage
    handedToSalesAt?: string | null
    handedToRelationsAt?: string | null
    lastContactedAt?: string | null
  }
): boolean {
  if (role === 'admin') return true
  if (role === 'lead_procurement') {
    return PROCUREMENT_STAGES.has(prospect.stage) && !prospect.handedToSalesAt
  }
  if (role === 'sales_closer') {
    if (!SALES_STAGES.has(prospect.stage)) return false
    if (prospect.stage === 'uncontacted') return true
    if (prospect.stage === 'emailed') {
      return Boolean(prospect.handedToSalesAt || prospect.lastContactedAt)
    }
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

const PROCUREMENT_LANE_STAGES: PipelineStage[] = ['uncontacted', 'emailed']
const SALES_WORK_STAGES: PipelineStage[] = [
  'contacted',
  'offer_made',
  'lost_nurture',
]

/** Columns on the board. Edit rights stay on stagesVisibleToRole, which is empty for client relations. */
export function boardLanes(role?: string | null): BoardLane[] {
  if (role === 'lead_procurement') {
    return [{
      id: 'procurement',
      title: 'Lead procurement',
      detail: 'Find the business, send the first email, and hand the lead to sales.',
      stages: [...PROCUREMENT_LANE_STAGES],
    }]
  }
  if (role === 'sales_closer') {
    return [
      {
        id: 'handed-to-sales',
        title: 'Uncontacted',
        detail: 'People who have not been emailed, and people who have. A call with no answer moves to Contacted.',
        stages: ['uncontacted', 'emailed'],
      },
      {
        id: 'sales',
        title: 'Sales',
        detail: 'Called with no answer, offers, and leads that go Inactive.',
        stages: [...SALES_WORK_STAGES],
      },
      {
        id: 'active',
        title: 'Active',
        detail: 'Accepted the proposal and paid. Bill the client from Today, then hand the file to client relations.',
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
      detail: 'Uncontacted people and the emails already sent.',
      stages: [...PROCUREMENT_LANE_STAGES],
    },
    {
      id: 'sales',
      title: 'Sales',
      detail: 'Calls with no answer, offers, and inactive leads.',
      stages: [...SALES_WORK_STAGES],
    },
    {
      id: 'client-relations',
      title: 'Client relations',
      detail: 'Active clients who accepted and paid.',
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
      item.href === '/admin' ||
      item.href === '/admin/calendar' ||
      item.href === '/admin/credit-funding' ||
      item.href === '/admin/todos' ||
      item.href === '/admin/messages' ||
      item.href === '/admin/settings'
    )
  }
  if (role === 'lead_procurement') {
    return ADMIN_NAV.filter((item) =>
      item.href === '/admin' ||
      item.href === '/admin/calendar' ||
      item.href === '/admin/marketing' ||
      item.href === '/admin/todos' ||
      item.href === '/admin/sales-kit' ||
      item.href === '/admin/training' ||
      item.href === '/admin/messages' ||
      item.href === '/admin/settings'
    )
  }
  if (role === 'sales_closer') {
    return ADMIN_NAV.filter((item) =>
      item.href === '/admin'
      || item.href === '/admin/calendar'
      || item.href === '/admin/marketing'
      || item.href === '/admin/todos'
      || item.href === '/admin/sales-kit'
      || item.href === '/admin/training'
      || item.href === '/admin/messages'
      || item.href === '/admin/settings'
    )
  }
  if (role === 'client_relations') {
    return ADMIN_NAV.filter((item) =>
      item.href === '/admin' ||
      item.href === '/admin/calendar' ||
      item.href === '/admin/marketing' ||
      item.href === '/admin/todos' ||
      item.href === '/admin/content-kit' ||
      item.href === '/admin/messages' ||
      item.href === '/admin/settings'
    )
  }
  if (role === 'admin') return ADMIN_NAV
  return []
}

export function homeForRole(role?: string | null): string {
  if (role === 'credit_manager') return '/admin'
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
    path.startsWith('/admin/messages/') ||
    path === '/admin/todos' ||
    path.startsWith('/admin/todos/') ||
    path === '/admin/calendar' ||
    path.startsWith('/admin/calendar/')
  ) return true
  if (role === 'lead_procurement' || role === 'sales_closer') {
    return (
      path === '/admin/marketing' ||
      path.startsWith('/admin/marketing/') ||
      path === '/admin/pipeline' ||
      path.startsWith('/admin/pipeline/') ||
      path === '/admin/outreach' ||
      path.startsWith('/admin/outreach/') ||
      path === '/admin/sales-kit' ||
      path.startsWith('/admin/sales-kit/') ||
      path === '/admin/training' ||
      path.startsWith('/admin/training/')
    )
  }
  if (role === 'client_relations') {
    return (
      path === '/admin/marketing' ||
      path.startsWith('/admin/marketing/') ||
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

/** Pipeline files are for admin and sales roles; client relations stays on the board list. */
export function roleMayOpenProspectFile(role?: string | null): boolean {
  return role === 'admin' || role === 'lead_procurement' || role === 'sales_closer'
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
  stripePaid?: boolean
}

export function stripeHasConfirmedPayment(client?: {
  last_payment_at?: string | null
  billing_status?: string | null
} | null): boolean {
  if (!client) return false
  const paidAt = client.last_payment_at?.trim()
  if (paidAt && !Number.isNaN(new Date(paidAt).getTime())) return true
  return client.billing_status === 'paid'
}

export function canSeeCloseSection(role: string | null | undefined, stripePaid: boolean): boolean {
  return roleMayRunSalesActions(role) && stripePaid
}

export type DirectCloseInput = {
  lastContactedAt?: string | null
  handedToSalesAt?: string | null
  agreementSigned?: boolean
  stripePaid?: boolean
}

/** Sales reached this business, so a later close can stand on the agreement and the paid invoice. */
export function salesContactedThisProspect(input: {
  lastContactedAt?: string | null
  handedToSalesAt?: string | null
}): boolean {
  return Boolean((input.lastContactedAt || '').trim() && (input.handedToSalesAt || '').trim())
}

/** Contacted by sales, agreement signed, and Stripe shows the invoice paid. */
export function directCloseSkipsMeetingAndProposal(input: DirectCloseInput): boolean {
  return (
    salesContactedThisProspect(input) &&
    Boolean(input.agreementSigned) &&
    Boolean(input.stripePaid)
  )
}

export function salesHandoffGaps(input: SalesChecklistInput & DirectCloseInput): string[] {
  const gaps: string[] = []
  if (!(input.servicesPurchased || '').trim()) gaps.push('Services purchased')
  if (!(input.scope || '').trim()) gaps.push('Scope')
  if (!(input.deliverables || '').trim()) gaps.push('Deliverables')
  if (!(input.deadline || '').trim()) gaps.push('Deadline')
  if (!(input.promises || '').trim()) gaps.push('Promises made')
  if (!(input.expectations || '').trim()) gaps.push('Client expectations')
  if (!input.agreementSigned) gaps.push('Agreement marked signed')
  if (!input.stripePaid) gaps.push('Stripe payment')
  if (!(input.proposalUrl || '').trim() && !directCloseSkipsMeetingAndProposal(input)) gaps.push('Proposal Doc')
  return gaps
}

export function canHandOffToSales(role: string | null | undefined, stage: PipelineStage): boolean {
  if (role !== 'admin' && role !== 'lead_procurement') return false
  return stage === 'uncontacted' || stage === 'emailed'
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
  'emailed',
  'contacted',
  'offer_made',
  'won',
  'lost_nurture',
])

const MEETING_OR_LATER = new Set<PipelineStage>([
  'contacted',
  'offer_made',
  'won',
])

const PROPOSAL_OR_LATER = new Set<PipelineStage>(['offer_made', 'won'])

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

export type PipelineBoardProspect = {
  id: string
  business: string
  contactName: string
  stage: PipelineStage
  score: number | null
  followUpAt: string | null
  handedToRelationsAt?: string | null
  source?: string
}

export function prospectVisibleInBoardStage(
  role: string,
  prospect: Pick<PipelineBoardProspect, 'stage' | 'handedToRelationsAt'>,
  stage: PipelineStage
): boolean {
  if (staffPipelineStage(prospect.stage) !== stage) return false
  if (role === 'sales_closer' && stage === 'won' && prospect.handedToRelationsAt) return false
  return true
}

export function pipelineProspectMatchesQuery(
  prospect: Pick<PipelineBoardProspect, 'business' | 'contactName' | 'source'>,
  query: string
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [prospect.business, prospect.contactName, prospect.source]
    .some((value) => (value || '').toLowerCase().includes(needle))
}

export function comparePipelineProspects(
  a: Pick<PipelineBoardProspect, 'business' | 'score' | 'followUpAt'>,
  b: Pick<PipelineBoardProspect, 'business' | 'score' | 'followUpAt'>
): number {
  const aFollow = a.followUpAt ? Date.parse(a.followUpAt) : Number.POSITIVE_INFINITY
  const bFollow = b.followUpAt ? Date.parse(b.followUpAt) : Number.POSITIVE_INFINITY
  const aTime = Number.isNaN(aFollow) ? Number.POSITIVE_INFINITY : aFollow
  const bTime = Number.isNaN(bFollow) ? Number.POSITIVE_INFINITY : bFollow
  if (aTime !== bTime) return aTime - bTime
  const aScore = a.score == null || Number.isNaN(a.score) ? -1 : a.score
  const bScore = b.score == null || Number.isNaN(b.score) ? -1 : b.score
  if (aScore !== bScore) return bScore - aScore
  return a.business.localeCompare(b.business)
}

export type MarketingKpiInput = {
  leadVolume: number
  emailsSent: number
  responsesRecorded: number
  consultationsBooked: number
  closed: number
  recordedRevenue: number
}

export type MarketingKpiView = {
  leadVolume: number
  responseRate: string
  responsesRecorded: number
  emailsSent: number
  consultationsBooked: number
  closeRate: string
  closed: number
  costPerLead: 'Unavailable'
  revenue: string
}

function kpiMoney(amount: number): string {
  const value = Number.isFinite(amount) ? Math.max(0, amount) : 0
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

/** Counts only saved facts. Consultations stay 0 until a date is stored. Cost per lead stays unavailable. */
export function marketingKpis(input: MarketingKpiInput): MarketingKpiView {
  const leadVolume = Math.max(0, input.leadVolume || 0)
  const emailsSent = Math.max(0, input.emailsSent || 0)
  const responsesRecorded = Math.max(0, input.responsesRecorded || 0)
  const consultationsBooked = Math.max(0, input.consultationsBooked || 0)
  const closed = Math.max(0, input.closed || 0)
  return {
    leadVolume,
    responseRate: percent(responsesRecorded, emailsSent),
    responsesRecorded,
    emailsSent,
    consultationsBooked,
    closeRate: percent(closed, leadVolume),
    closed,
    costPerLead: 'Unavailable',
    revenue: kpiMoney(input.recordedRevenue),
  }
}

export function marketingKpiCounts(
  rows: Array<{
    stage: PipelineStage
    gmailThreadId?: string | null
    repliedAt?: string | null
    consultationBookedAt?: string | null
  }>,
  recordedRevenue: number
): MarketingKpiView {
  return marketingKpis({
    leadVolume: rows.length,
    emailsSent: rows.filter((row) => Boolean(row.gmailThreadId)).length,
    responsesRecorded: rows.filter((row) => Boolean(row.repliedAt)).length,
    consultationsBooked: rows.filter((row) => Boolean(row.consultationBookedAt)).length,
    closed: rows.filter((row) => row.stage === 'won').length,
    recordedRevenue,
  })
}

export function filterPipelineProspects<T extends PipelineBoardProspect>(
  prospects: T[],
  input: { query?: string; stage?: PipelineStage | '' }
): T[] {
  const stage = input.stage || ''
  return prospects
    .filter((prospect) => pipelineProspectMatchesQuery(prospect, input.query || ''))
    .filter((prospect) => !stage || staffPipelineStage(prospect.stage) === stage)
    .slice()
    .sort(comparePipelineProspects)
}
