import crypto from 'crypto'
import { getSupabase } from './supabase'

// ══════════════════════════════════════════════════════════
// Database Layer — Supabase (PostgreSQL)
// All functions are async now
// ══════════════════════════════════════════════════════════

// ══════════ PASSWORD HASHING ══════════
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

// ══════════ USERS ══════════
export interface User {
  id: string
  email: string
  password: string
  name: string
  role: 'admin' | 'client'
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
  role: 'admin' | 'client'
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

// ══════════ LEADS ══════════
export interface Lead {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  business: string
  industry?: string
  service?: string
  budget?: string
  message?: string
  status: 'new' | 'contacted' | 'audit_sent' | 'proposal' | 'won' | 'lost'
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

export async function createLead(leadData: {
  first_name: string
  last_name?: string
  email: string
  phone?: string
  business: string
  industry?: string
  service?: string
  budget?: string
  message?: string
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

// ══════════ CLIENTS ══════════
export interface Client {
  id: string
  name: string
  business: string
  email: string
  phone?: string
  industry?: string
  package_tier: 'social_essentials' | 'spark' | 'growth' | 'scale'
  monthly_price: number
  start_date: string
  status: 'active' | 'paused' | 'churned'
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

// ══════════ MESSAGES ══════════
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
  if (error) { console.error('getMessages error:', error); return [] }
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

// ══════════ ADMIN DATA ══════════
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

export async function updateAdminData(updates: Partial<AdminData>): Promise<AdminData> {
  const current = await getAdminData()
  const merged = { id: 'singleton', ...current, ...updates }
  const { data, error } = await getSupabase()
    .from('admin_data')
    .upsert(merged)
    .select()
    .single()
  if (error) { console.error('updateAdminData error:', error); return merged }
  return data
}

// ══════════ ACTIVITY LOG ══════════
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

// ══════════ SEED DEFAULT ADMIN ══════════
export async function seedAdmin(): Promise<void> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'sales@sundayharmony.com'
    const adminPass = process.env.ADMIN_PASSWORD || 'sundayharmony2025'
    const existing = await getUserByEmail(adminEmail)
    if (!existing) {
      await createUser({
        email: adminEmail,
        password: adminPass,
        name: 'Mac Cesar',
        role: 'admin',
      })
      console.log('Admin account created:', adminEmail)
    }
  } catch (err) {
    console.error('Failed to seed admin:', err)
  }
}
