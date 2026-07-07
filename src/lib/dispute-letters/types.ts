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

export function sourceLabel(source: string) {
  if (source === 'cursor_agent') return 'AI analyzed'
  if (source === 'fallback_parser') return 'Local parse'
  return source
}
