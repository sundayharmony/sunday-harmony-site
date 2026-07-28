export type RepairPriority = 'high' | 'medium' | 'low' | 'none'
export type BureauCode = 'TUC' | 'EXP' | 'EQF'

export interface BureauScores {
  tuc: number | null
  exp: number | null
  eqf: number | null
}

export interface CreditHealthSummary {
  scores: BureauScores
  total_accounts: number
  negative_count: number
  collection_count: number
  high_priority_count: number
  repair_summary: string
  recommended_actions: string[]
}

export interface FactorAnalysis {
  factor: string
  weight_hint: number
  summary: string
  score_band: string
  findings: Record<string, unknown>[]
  metrics: Record<string, unknown>
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
}

export interface OverallCreditHealth {
  band: string
  narrative: string
  strengths: string[]
  weaknesses: string[]
  risk_factors: string[]
  improvement_priorities: string[]
  average_score: number | null
}

export interface FundingReadinessAssessment {
  level: string
  /** Advisory engine score (0–100). Does not overwrite application FundingScores.funding_readiness. */
  score_0_to_100: number
  summary: string
  blockers: string[]
  supportive_signals: string[]
  practical_steps: string[]
}

export interface Recommendation {
  id: string
  title: string
  category: string
  rationale: string
  estimated_impact: number
  confidence: number
  priority_score: number
  suggested_actions: string[]
  related_tradeline_ids: string[]
  legal_basis: string
}

export interface AccountDisputeInsight {
  tradeline_id: string
  creditor: string
  category: string
  repair_priority: RepairPriority | string
  dispute_recommended: boolean
  rationale: string
  suggested_dispute_reason?: string
  supporting_facts?: Record<string, unknown>
  legal_citations?: string[]
}

export interface CreditIntelligenceReport {
  version: string
  analyzed_at: string
  report_date: string
  consumer_name: string
  factors: FactorAnalysis[]
  overall: OverallCreditHealth
  funding_readiness: FundingReadinessAssessment
  recommendations: Recommendation[]
  account_dispute_insights: AccountDisputeInsight[]
  recommended_next_steps: string[]
  disclaimer: string
}

export interface FundingContextPayload {
  credit_goals?: string[]
  funding_goals?: string
  funding_amount?: string
  funding_timeframe?: string
  monthly_income?: string
  annual_income?: string
  annual_revenue?: string
  business_year_established?: string
  self_reported_score?: string
  self_reported_collections?: boolean
  self_reported_charge_offs?: boolean
  self_reported_bankruptcy?: boolean
  self_reported_late_payments?: boolean
  self_reported_inquiries?: string
  document_types?: string[]
}

export interface ConsumerInfo {
  name: string
  dob: string
  ssn_last4: string
  addresses: string[]
}

export interface Tradeline {
  id: string
  creditor: string
  account_tu: string
  account_exp: string
  account_eqf: string
  account_type: string
  status: string
  balance: string
  past_due: string
  remarks: string
  credit_limit?: string
  high_credit?: string
  date_opened?: string
  date_of_first_delinquency?: string
  last_reported?: string
  payment_history?: string
  monthly_payment?: string
  bureaus: BureauCode[]
  is_collection: boolean
  selected: boolean
  dispute_reason: string
  analysis_notes: string
  suggested_dispute_reason: string
  dispute_bureaus: BureauCode[]
  dispute_furnisher: boolean
  legal_flags: string[]
  repair_priority: RepairPriority
  item_category: string
}

export interface ParsedReport {
  source: string
  reference: string
  report_date: string
  analysis_summary: string
  credit_health: CreditHealthSummary
  credit_intelligence?: CreditIntelligenceReport | null
  consumer: ConsumerInfo
  tradelines: Tradeline[]
  subscribers: { name: string; address_lines: string[]; phone: string }[]
  file_type: string
  ocr_used: boolean
  extraction_quality: string
}

export interface ReportHealth {
  session_id: string
  credit_health: CreditHealthSummary
  credit_intelligence?: CreditIntelligenceReport | null
  tradelines_by_priority: Tradeline[]
  consumer_name: string
  report_date: string
  source: string
}

export interface LetterItem {
  tradeline_id: string
  creditor: string
  account_number: string
  bureau: string
  status: string
  balance: string
  dispute_reason: string
}

export interface LetterPlan {
  id: string
  letter_type: string
  recipient_name: string
  recipient_lines: string[]
  statute: string
  items: LetterItem[]
  missing_address?: boolean
}

export interface GeneratedLetter {
  id: string
  plan_id: string
  title: string
  markdown: string
  html?: string
  plain_text?: string
  file_path: string
}

export type DisputeSessionStatus = 'uploaded' | 'analyzing' | 'ready' | 'failed'

export interface DisputeSessionListItem {
  id: string
  admin_user_id: string
  status: DisputeSessionStatus
  storage_path: string
  file_name: string
  file_type: string
  report_json: ParsedReport | null
  error_message: string | null
  application_uuid?: string | null
  intelligence_json?: CreditIntelligenceReport | null
  created_at: string
  updated_at: string
}

export interface AppConfig {
  cursor_api_configured: boolean
}

export const BUREAU_LABELS: Record<BureauCode, string> = {
  TUC: 'TransUnion',
  EXP: 'Experian',
  EQF: 'Equifax',
}

export const PRIORITY_ORDER: Record<RepairPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
}

export const FACTOR_LABELS: Record<string, string> = {
  payment_history: 'Payment History',
  revolving_utilization: 'Revolving Utilization',
  installment_loans: 'Installment Loans',
  collections: 'Collections',
  charge_offs: 'Charge-Offs',
  hard_inquiries: 'Hard Inquiries',
  public_records: 'Public Records',
  credit_mix: 'Credit Mix',
  account_age: 'Account Age',
}

export function sourceLabel(source: string) {
  if (source === 'cursor_agent') return 'AI analyzed'
  if (source === 'fallback_parser') return 'Local parse'
  return source
}

export function impactPercent(value: number) {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`
}

export type CreditProgressDirection = 'improved' | 'worsened' | 'unchanged' | 'unknown'

export interface CreditProgressHealthCounts {
  total_accounts: number | null
  negative_count: number | null
  collection_count: number | null
}

export interface CreditProgressSnapshot {
  sessionId: string
  createdAt: string
  reportDate: string
  analyzedAt: string
  fileName: string
  overallBand: string | null
  averageScore: number | null
  fundingLevel: string | null
  fundingScore: number | null
  factorBands: Record<string, string>
  healthCounts: CreditProgressHealthCounts
}

export interface CreditProgressDelta {
  field: string
  label: string
  from: string | number | null
  to: string | number | null
  direction: CreditProgressDirection
}

export interface CreditProgressReport {
  baseline: CreditProgressSnapshot | null
  previous: CreditProgressSnapshot | null
  current: CreditProgressSnapshot | null
  vsBaseline: CreditProgressDelta[]
  vsPrevious: CreditProgressDelta[]
  readyCount: number
}
