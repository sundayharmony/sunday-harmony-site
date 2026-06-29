import crypto from 'crypto'
import { getSupabase } from './supabase'

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Database Layer â Supabase (PostgreSQL)
// All functions are async now
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

// ââââââââââ PASSWORD HASHING ââââââââââ
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return hash === verify
}

// ââââââââââ USERS ââââââââââ
export interface User {
  id: string
  email: string
  password: string
  name: string
  role: 'admin' | 'client' | 'credit_manager'
  client_id?: string
  created_at: string
}

export async function getUsers(): Promise<User[]> {
  const { data, error } = await getSupabase().from('users').select('*')
  if (error) { console.error('getUsers error:', error); return [] }
  return data || []
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .ilike('email', email)
    .single()
  if (error) return undefined
  return data
}

export async function getUserById(id: string): Promise<User | undefined> {
  const { data, error } = await getSupabase().from('users').select('*').eq('id', id).single()
  if (error) return undefined
  return data
}

export async function createUser(userData: {
  email: string
  password: string
  name: string
  role: 'admin' | 'client' | 'credit_manager'
  client_id?: string
}): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from('users')
    .insert({
      email: userData.email,
      password: hashPassword(userData.password),
      name: userData.name,
      role: userData.role,
      client_id: userData.client_id,
    })
    .select()
    .single()
  if (error) { console.error('createUser error:', error); return null }
  return data
}

export async function updateUser(id: string, updates: Partial<Omit<User, 'id'>>): Promise<User | null> {
  if (updates.password) updates.password = hashPassword(updates.password)
  const { data, error } = await getSupabase().from('users').update(updates).eq('id', id).select().single()
  if (error) { console.error('updateUser error:', error); return null }
  return data
}

export async function deleteUser(id: string): Promise<boolean> {
  const { error } = await getSupabase().from('users').delete().eq('id', id)
  if (error) {
    console.error('deleteUser error:', error)
    return false
  }
  return true
}

export async function getCreditManagers(): Promise<User[]> {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .eq('role', 'credit_manager')
  if (error) {
    console.error('getCreditManagers error:', error)
    return []
  }
  return data || []
}

// ââââââââââ LEADS ââââââââââ
export interface Lead {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  business: string
  industry?: string
  service?: string
  budget?: string
  message?: string
  source: 'inbound' | 'outbound'
  website?: string
  google_place_id?: string
  location_text?: string
  discovered_at?: string
  last_contacted_at?: string
  status: 'new' | 'contacted' | 'audit_sent' | 'proposal' | 'won' | 'lost'
  lead_type?: string
  marketing_lead_status?: string | null
  credit_funding_client_status?: string | null
  assigned_team_member?: string | null
  client_id?: string | null
  notes: string
  created_at: string
  updated_at: string
}

export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await getSupabase().from('leads').select('*').order('created_at', { ascending: false })
  if (error) { console.error('getLeads error:', error); return [] }
  return data || []
}

export async function getLeadById(id: string): Promise<Lead | undefined> {
  const { data, error } = await getSupabase().from('leads').select('*').eq('id', id).single()
  if (error) return undefined
  return data
}

export async function getLeadByGooglePlaceId(googlePlaceId: string): Promise<Lead | undefined> {
  const { data, error } = await getSupabase().from('leads').select('*').eq('google_place_id', googlePlaceId).single()
  if (error) return undefined
  return data
}

export async function createLead(leadData: {
  first_name: string
  last_name?: string
  email?: string
  phone?: string
  business: string
  industry?: string
  service?: string
  budget?: string
  message?: string
  source?: 'inbound' | 'outbound'
  website?: string
  google_place_id?: string
  location_text?: string
  discovered_at?: string
  last_contacted_at?: string
  lead_type?: string
  marketing_lead_status?: string | null
  credit_funding_client_status?: string | null
  assigned_team_member?: string | null
  client_id?: string | null
}): Promise<Lead | null> {
  const { data, error } = await getSupabase()
    .from('leads')
    .insert({
      first_name: leadData.first_name,
      last_name: leadData.last_name || '',
      email: leadData.email,
      phone: leadData.phone,
      business: leadData.business,
      industry: leadData.industry,
      service: leadData.service,
      budget: leadData.budget,
      message: leadData.message,
      source: leadData.source || 'inbound',
      website: leadData.website,
      google_place_id: leadData.google_place_id,
      location_text: leadData.location_text,
      discovered_at: leadData.discovered_at,
      last_contacted_at: leadData.last_contacted_at,
      lead_type: leadData.lead_type || 'marketing_lead',
      marketing_lead_status: leadData.marketing_lead_status ?? 'new_lead',
      credit_funding_client_status: leadData.credit_funding_client_status,
      assigned_team_member: leadData.assigned_team_member,
      client_id: leadData.client_id,
    })
    .select()
    .single()
  if (error) { console.error('createLead error:', error); return null }
  return data
}

export async function updateLead(id: string, updates: Partial<Omit<Lead, 'id' | 'created_at'>>): Promise<Lead | null> {
  const updateData = { ...updates, updated_at: new Date().toISOString() }
  const { data, error } = await getSupabase().from('leads').update(updateData).eq('id', id).select().single()
  if (error) { console.error('updateLead error:', error); return null }
  return data
}

export async function deleteLead(id: string): Promise<boolean> {
  const { error } = await getSupabase().from('leads').delete().eq('id', id)
  if (error) {
    console.error('deleteLead error:', error)
    return false
  }
  return true
}

// ââââââââââ CLIENTS ââââââââââ
export interface Client {
  id: string
  name: string
  business: string
  email: string
  phone?: string
  industry?: string
  package_tier: 'free' | 'social_essentials' | 'spark' | 'growth' | 'scale'
  monthly_price: number
  start_date: string
  status: 'active' | 'paused' | 'churned'
  is_potential: boolean
  billing_status: 'not_started' | 'trial' | 'paid' | 'past_due' | 'unpaid'
  stripe_customer_id?: string
  stripe_subscription_id?: string
  last_payment_at?: string
  next_billing_date?: string
  lead_type?: string | null
  marketing_lead_status?: string | null
  credit_funding_client_status?: string | null
  assigned_team_member?: string | null
  lead_id?: string | null
  notes: string
  deliverables: string[]
  quick_wins: { text: string; done: boolean }[]
  created_at: string
  updated_at: string
}

export async function getClients(): Promise<Client[]> {
  const { data, error } = await getSupabase().from('clients').select('*').order('created_at', { ascending: false })
  if (error) { console.error('getClients error:', error); return [] }
  return data || []
}

export async function getClientById(id: string): Promise<Client | undefined> {
  const { data, error } = await getSupabase().from('clients').select('*').eq('id', id).single()
  if (error) return undefined
  return data
}

export async function getClientByStripeCustomerId(stripeCustomerId: string): Promise<Client | undefined> {
  const { data, error } = await getSupabase().from('clients').select('*').eq('stripe_customer_id', stripeCustomerId).single()
  if (error) return undefined
  return data
}

export async function getClientByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Client | undefined> {
  const { data, error } = await getSupabase().from('clients').select('*').eq('stripe_subscription_id', stripeSubscriptionId).single()
  if (error) return undefined
  return data
}

export async function createClient(clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client | null> {
  const { data, error } = await getSupabase().from('clients').insert(clientData).select().single()
  if (error) { console.error('createClient error:', error); return null }
  return data
}

export async function updateClient(id: string, updates: Partial<Omit<Client, 'id' | 'created_at'>>): Promise<Client | null> {
  const updateData = { ...updates, updated_at: new Date().toISOString() }
  const { data, error } = await getSupabase().from('clients').update(updateData).eq('id', id).select().single()
  if (error) { console.error('updateClient error:', error); return null }
  return data
}

export async function deleteUsersByClientId(clientId: string): Promise<boolean> {
  const { error } = await getSupabase().from('users').delete().eq('client_id', clientId)
  if (error) {
    console.error('deleteUsersByClientId error:', error)
    return false
  }
  return true
}

export async function deleteClient(id: string): Promise<boolean> {
  const usersOk = await deleteUsersByClientId(id)
  if (!usersOk) return false

  const { error } = await getSupabase().from('clients').delete().eq('id', id)
  if (error) {
    console.error('deleteClient error:', error)
    return false
  }
  return true
}

// ââââââââââ MESSAGES ââââââââââ
export interface Message {
  id: string
  client_id: string
  from_role: 'admin' | 'client'
  from_name: string
  text: string
  created_at: string
}

export async function getMessages(clientId?: string): Promise<Message[]> {
  let query = getSupabase().from('messages').select('*').order('created_at', { ascending: true })
  if (clientId) query = query.eq('client_id', clientId)
  const { data, error } = await query
  if (error) {
    // Suppress "relation does not exist" errors (table not yet created)
    if (error.code !== '42P01') console.error('getMessages error:', error)
    return []
  }
  return data || []
}

export async function createMessage(msgData: {
  client_id: string
  from_role: 'admin' | 'client'
  from_name: string
  text: string
}): Promise<Message | null> {
  const { data, error } = await getSupabase().from('messages').insert(msgData).select().single()
  if (error) { console.error('createMessage error:', error); return null }
  return data
}

// ═══════ STAFF MESSAGES (admin ↔ credit_manager) ═══════
export interface StaffMessage {
  id: string
  from_user_id: string
  text: string
  created_at: string
  from_name?: string
  from_role?: string
}

export async function getStaffMessages(): Promise<StaffMessage[]> {
  const { data, error } = await getSupabase()
    .from('staff_messages')
    .select('id, from_user_id, text, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    if (error.code !== '42P01') console.error('getStaffMessages error:', error)
    return []
  }

  const rows = data || []
  if (rows.length === 0) return []

  const userIds = [...new Set(rows.map((r) => r.from_user_id))]
  const { data: users } = await getSupabase()
    .from('users')
    .select('id, name, role')
    .in('id', userIds)

  const userMap = new Map((users || []).map((u) => [u.id, u]))

  return rows.map((row) => {
    const user = userMap.get(row.from_user_id)
    return {
      id: row.id,
      from_user_id: row.from_user_id,
      text: row.text,
      created_at: row.created_at,
      from_name: user?.name,
      from_role: user?.role,
    }
  })
}

export async function createStaffMessage(msgData: {
  from_user_id: string
  text: string
}): Promise<StaffMessage | null> {
  const { data, error } = await getSupabase()
    .from('staff_messages')
    .insert({ from_user_id: msgData.from_user_id, text: msgData.text })
    .select('id, from_user_id, text, created_at')
    .single()

  if (error) {
    console.error('createStaffMessage error:', error)
    return null
  }
  return data
}

export async function getStaffUsers(): Promise<User[]> {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .in('role', ['admin', 'credit_manager'])
    .order('name', { ascending: true })

  if (error) {
    console.error('getStaffUsers error:', error)
    return []
  }
  return data || []
}

// ââââââââââ ADMIN DATA ââââââââââ
export interface AdminData {
  roadmap_tasks: Record<string, boolean>
  positioning_canvas: Record<string, string>
  research_tasks: Record<string, boolean>
  weekly_activity: Record<string, number>
}

export async function getAdminData(): Promise<AdminData> {
  const fallback: AdminData = { roadmap_tasks: {}, positioning_canvas: {}, research_tasks: {}, weekly_activity: {} }
  const { data, error } = await getSupabase().from('admin_data').select('*').eq('id', 'singleton').single()
  if (error) return fallback
  return {
    roadmap_tasks: data.roadmap_tasks || {},
    positioning_canvas: data.positioning_canvas || {},
    research_tasks: data.research_tasks || {},
    weekly_activity: data.weekly_activity || {},
  }
}

export async function updateAdminData(updates: Partial<AdminData>): Promise<AdminData | null> {
  const current = await getAdminData()
  const merged = { id: 'singleton', ...current, ...updates }
  const { data, error } = await getSupabase()
    .from('admin_data')
    .upsert(merged)
    .select()
    .single()
  if (error) {
    console.error('updateAdminData error:', error)
    return null
  }
  return data
}

// ââââââââââ ACTIVITY LOG ââââââââââ
export interface ActivityLog {
  id: string
  action: string
  entity_type: string
  entity_id?: string
  actor_email: string
  details?: string
  created_at: string
}

export async function logActivity(entry: {
  action: string
  entity_type: string
  entity_id?: string
  actor_email: string
  details?: string
}): Promise<void> {
  try {
    await getSupabase().from('activity_log').insert(entry)
  } catch (err) {
    console.error('Failed to log activity:', err)
  }
}

export async function getActivityLog(limit = 50): Promise<ActivityLog[]> {
  const { data, error } = await getSupabase()
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('getActivityLog error:', error); return [] }
  return data || []
}

// ââââââââââ ONBOARDING RESPONSES ââââââââââ
export interface OnboardingResponse {
  id: string
  client_id: string
  business_goals: string
  target_audience: string
  brand_voice: string
  social_accounts: Record<string, string>
  google_business_url: string
  existing_assets: string
  competitors: string
  additional_notes: string
  completed: boolean
  created_at: string
  updated_at: string
}

export async function getOnboardingResponse(clientId: string): Promise<OnboardingResponse | null> {
  const { data, error } = await getSupabase().from('onboarding_responses').select('*').eq('client_id', clientId).single()
  if (error) return null
  return data
}

export async function upsertOnboardingResponse(clientId: string, updates: Partial<Omit<OnboardingResponse, 'id' | 'client_id' | 'created_at'>>): Promise<OnboardingResponse | null> {
  const { data, error } = await getSupabase()
    .from('onboarding_responses')
    .upsert({ client_id: clientId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
    .select()
    .single()
  if (error) { console.error('upsertOnboarding error:', error); return null }
  return data
}

// ââââââââââ FILES ââââââââââ
export interface FileRecord {
  id: string
  client_id: string
  name: string
  file_url: string
  file_size: number
  file_type: string
  uploaded_by_role: 'admin' | 'client'
  uploaded_by_name: string
  category: string
  created_at: string
}

export async function getFilesByClient(clientId: string): Promise<FileRecord[]> {
  const { data, error } = await getSupabase().from('files').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) { console.error('getFiles error:', error); return [] }
  return data || []
}

export async function createFileRecord(file: Omit<FileRecord, 'id' | 'created_at'>): Promise<FileRecord | null> {
  const { data, error } = await getSupabase().from('files').insert(file).select().single()
  if (error) { console.error('createFile error:', error); return null }
  return data
}

export async function getFileById(id: string): Promise<FileRecord | null> {
  const { data, error } = await getSupabase().from('files').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export async function deleteFileRecord(id: string): Promise<boolean> {
  const { error } = await getSupabase().from('files').delete().eq('id', id)
  return !error
}

// ââââââââââ CLIENT CASE STUDIES ââââââââââ
export interface CaseStudy {
  id: string
  title: string
  file_url: string
  storage_path: string
  file_size: number
  published: boolean
  uploaded_by_name: string
  created_at: string
  updated_at: string
}

/** @deprecated Use CaseStudy */
export type ClientCaseStudy = CaseStudy

export async function getPublishedCaseStudies(): Promise<CaseStudy[]> {
  const { data, error } = await getSupabase()
    .from('client_case_studies')
    .select('*')
    .eq('published', true)
    .order('title', { ascending: true })

  if (error) {
    console.error('getPublishedCaseStudies error:', error)
    return []
  }

  return (data || []) as CaseStudy[]
}

export async function getAllCaseStudiesForAdmin(): Promise<CaseStudy[]> {
  const { data, error } = await getSupabase()
    .from('client_case_studies')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('getAllCaseStudiesForAdmin error:', error)
    return []
  }

  return (data || []) as CaseStudy[]
}

export async function getCaseStudyById(id: string): Promise<CaseStudy | null> {
  const { data, error } = await getSupabase()
    .from('client_case_studies')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('getCaseStudyById error:', error)
    return null
  }
  return data
}

export async function insertCaseStudy(
  record: Omit<CaseStudy, 'id' | 'created_at' | 'updated_at'>
): Promise<CaseStudy | null> {
  const now = new Date().toISOString()
  const { data, error } = await getSupabase()
    .from('client_case_studies')
    .insert({
      ...record,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (error) {
    console.error('insertCaseStudy error:', error)
    return null
  }
  return data
}

export async function updateCaseStudy(
  id: string,
  updates: Partial<Pick<CaseStudy, 'title' | 'published' | 'file_url' | 'storage_path' | 'file_size'>>
): Promise<CaseStudy | null> {
  const { data, error } = await getSupabase()
    .from('client_case_studies')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('updateCaseStudy error:', error)
    return null
  }
  return data
}

/** @deprecated Use updateCaseStudy */
export const updateClientCaseStudy = updateCaseStudy

export async function deleteCaseStudy(id: string): Promise<CaseStudy | null> {
  const { data: existing } = await getSupabase()
    .from('client_case_studies')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return null

  const { error } = await getSupabase().from('client_case_studies').delete().eq('id', id)
  if (error) {
    console.error('deleteCaseStudy error:', error)
    return null
  }
  return existing as CaseStudy
}

/** @deprecated Use deleteCaseStudy */
export const deleteClientCaseStudy = deleteCaseStudy

// ââââââââââ TASKS ââââââââââ
export interface Task {
  id: string
  client_id: string
  title: string
  description: string
  status: 'not_started' | 'in_progress' | 'in_review' | 'completed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  category: string
  created_at: string
  updated_at: string
}

export async function getTasksByClient(clientId: string): Promise<Task[]> {
  const { data, error } = await getSupabase().from('tasks').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) { console.error('getTasks error:', error); return [] }
  return data || []
}

export async function createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task | null> {
  const { data, error } = await getSupabase().from('tasks').insert(task).select().single()
  if (error) { console.error('createTask error:', error); return null }
  return data
}

export async function updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'created_at'>>): Promise<Task | null> {
  const { data, error } = await getSupabase().from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) { console.error('updateTask error:', error); return null }
  return data
}

export async function deleteTask(id: string): Promise<boolean> {
  const { error } = await getSupabase().from('tasks').delete().eq('id', id)
  return !error
}

// ââââââââââ NOTIFICATIONS ââââââââââ
export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'message' | 'task' | 'file' | 'billing' | 'approval'
  link: string
  read: boolean
  created_at: string
}

export async function getNotifications(userId: string, unreadOnly = false): Promise<Notification[]> {
  let query = getSupabase().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
  if (unreadOnly) query = query.eq('read', false)
  const { data, error } = await query
  if (error) {
    if (error.code !== '42P01') console.error('getNotifications error:', error)
    return []
  }
  return data || []
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await getSupabase().from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false)
  if (error) {
    if (error.code !== '42P01') console.error('getUnreadCount error:', error)
    return 0
  }
  return count || 0
}

export async function createNotification(notif: Omit<Notification, 'id' | 'read' | 'created_at'>): Promise<Notification | null> {
  const { data, error } = await getSupabase().from('notifications').insert(notif).select().single()
  if (error) {
    if (error.code !== '42P01') console.error('createNotification error:', error)
    return null
  }
  return data
}

export async function getNotificationById(id: string): Promise<Notification | null> {
  const { data, error } = await getSupabase().from('notifications').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export async function markNotificationRead(id: string): Promise<void> {
  await getSupabase().from('notifications').update({ read: true }).eq('id', id)
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await getSupabase().from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
}

// ââââââââââ APPROVALS ââââââââââ
export interface Approval {
  id: string
  client_id: string
  title: string
  description: string
  content_type: 'social_post' | 'ad_copy' | 'email' | 'blog' | 'graphic' | 'other'
  content_url: string
  content_text: string
  status: 'pending' | 'approved' | 'revision_requested'
  admin_notes: string
  client_feedback: string
  created_at: string
  updated_at: string
}

export async function getApprovalsByClient(clientId: string): Promise<Approval[]> {
  const { data, error } = await getSupabase().from('approvals').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) { console.error('getApprovals error:', error); return [] }
  return data || []
}

export async function getApprovalById(id: string): Promise<Approval | null> {
  const { data, error } = await getSupabase().from('approvals').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export async function createApproval(approval: Omit<Approval, 'id' | 'created_at' | 'updated_at'>): Promise<Approval | null> {
  const { data, error } = await getSupabase().from('approvals').insert(approval).select().single()
  if (error) { console.error('createApproval error:', error); return null }
  return data
}

export async function updateApproval(id: string, updates: Partial<Omit<Approval, 'id' | 'created_at'>>): Promise<Approval | null> {
  const { data, error } = await getSupabase().from('approvals').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) { console.error('updateApproval error:', error); return null }
  return data
}

export async function deleteApproval(id: string): Promise<boolean> {
  const { error } = await getSupabase().from('approvals').delete().eq('id', id)
  if (error) {
    console.error('deleteApproval error:', error)
    return false
  }
  return true
}

/** Insert event id before processing. Returns duplicate if already handled. */
export async function claimStripeWebhookEvent(
  eventId: string
): Promise<'claimed' | 'duplicate' | 'failed'> {
  try {
    const { error } = await getSupabase().from('stripe_webhook_events').insert({ id: eventId })
    if (error) {
      if (error.code === '23505') return 'duplicate'
      console.error('claimStripeWebhookEvent:', error)
      return 'failed'
    }
    return 'claimed'
  } catch (err) {
    console.error('claimStripeWebhookEvent:', err)
    return 'failed'
  }
}

/** Release claim so Stripe retries can re-process after a handler failure. */
export async function releaseStripeWebhookEvent(eventId: string): Promise<void> {
  try {
    const { error } = await getSupabase().from('stripe_webhook_events').delete().eq('id', eventId)
    if (error) console.error('releaseStripeWebhookEvent:', error)
  } catch (err) {
    console.error('releaseStripeWebhookEvent:', err)
  }
}

let adminSeededThisProcess = false

// ââââââââââ SEED DEFAULT ADMIN ââââââââââ
export async function seedAdmin(): Promise<void> {
  if (adminSeededThisProcess) return

  const adminPass = process.env.ADMIN_PASSWORD
  if (!adminPass) {
    if (process.env.NODE_ENV === 'production') {
      console.error('seedAdmin: ADMIN_PASSWORD is required in production')
    }
    return
  }

  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'sales@sundayharmony.com'
    const hashedPass = hashPassword(adminPass)

    // Use upsert to avoid duplicate key errors when getUserByEmail
    // fails due to transient issues and then createUser tries to insert a duplicate
    const { error } = await getSupabase()
      .from('users')
      .upsert(
        { email: adminEmail, password: hashedPass, name: 'Mac Cesar', role: 'admin' },
        { onConflict: 'email', ignoreDuplicates: true }
      )
    if (error && !error.message?.includes('duplicate') && !error.code?.startsWith('23')) {
      console.error('seedAdmin error:', error)
    } else {
      adminSeededThisProcess = true
    }
  } catch (err) {
    // Silently ignore seed failures â the admin likely already exists
  }
}

function normalizeLeadLoose(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeLeadPhone(value?: string): string {
  return (value || '').replace(/\D+/g, '')
}

/** Find duplicate lead by business + phone or website without loading all leads. */
export async function findLeadDuplicate(
  business: string,
  phone?: string,
  website?: string
): Promise<Lead | undefined> {
  const trimmed = business.trim()
  if (!trimmed) return undefined

  const { data, error } = await getSupabase().from('leads').select('*').ilike('business', trimmed)
  if (error || !data?.length) return undefined

  const businessNorm = normalizeLeadLoose(trimmed)
  const phoneNorm = normalizeLeadPhone(phone)
  const websiteNorm = normalizeLeadLoose(website)

  return data.find(lead => {
    if (normalizeLeadLoose(lead.business) !== businessNorm) return false
    const samePhone = phoneNorm && normalizeLeadPhone(lead.phone) === phoneNorm
    const sameWebsite = websiteNorm && normalizeLeadLoose(lead.website) === websiteNorm
    return Boolean(samePhone || sameWebsite)
  })
}
