import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// ══════════════════════════════════════════════════════════
// JSON File Database
// Uses /tmp on Vercel (serverless, read-only filesystem)
// Uses ./data locally for persistence during dev
// Easy to migrate to Prisma + a real DB later
// ══════════════════════════════════════════════════════════

const IS_VERCEL = process.env.VERCEL === '1' || !!process.env.VERCEL_URL
const DATA_DIR = IS_VERCEL
  ? path.join('/tmp', 'sh-data')
  : path.join(process.cwd(), 'data')

function ensureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  } catch (err) {
    console.error('Failed to create data directory:', err)
  }
}

function readFile<T>(filename: string, fallback: T): T {
  ensureDir()
  const filepath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(filepath)) return fallback
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
  } catch {
    return fallback
  }
}

function writeFile<T>(filename: string, data: T): void {
  ensureDir()
  const filepath = path.join(DATA_DIR, filename)
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error(`Failed to write ${filename}:`, err)
  }
}

// ══════════ PASSWORD HASHING (simple, no bcrypt dependency) ══════════
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const verify = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return hash === verify
}

// ══════════ USERS ══════════
export interface User {
  id: string
  email: string
  password: string // hashed
  name: string
  role: 'admin' | 'client'
  clientId?: string // links to client record
  createdAt: string
}

export function getUsers(): User[] {
  return readFile<User[]>('users.json', [])
}

export function getUserByEmail(email: string): User | undefined {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase())
}

export function getUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id)
}

export function createUser(data: Omit<User, 'id' | 'createdAt' | 'password'> & { password: string }): User {
  const users = getUsers()
  const user: User = {
    ...data,
    id: crypto.randomUUID(),
    password: hashPassword(data.password),
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  writeFile('users.json', users)
  return user
}

export function updateUser(id: string, updates: Partial<Omit<User, 'id'>>): User | null {
  const users = getUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx === -1) return null
  if (updates.password) updates.password = hashPassword(updates.password)
  users[idx] = { ...users[idx], ...updates }
  writeFile('users.json', users)
  return users[idx]
}

// ══════════ LEADS ══════════
export interface Lead {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  business: string
  industry?: string
  service?: string
  budget?: string
  message?: string
  status: 'new' | 'contacted' | 'audit_sent' | 'proposal' | 'won' | 'lost'
  notes: string
  createdAt: string
  updatedAt: string
}

export function getLeads(): Lead[] {
  return readFile<Lead[]>('leads.json', [])
}

export function getLeadById(id: string): Lead | undefined {
  return getLeads().find(l => l.id === id)
}

export function createLead(data: Omit<Lead, 'id' | 'status' | 'notes' | 'createdAt' | 'updatedAt'>): Lead {
  const leads = getLeads()
  const lead: Lead = {
    ...data,
    id: crypto.randomUUID(),
    status: 'new',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  leads.push(lead)
  writeFile('leads.json', leads)
  return lead
}

export function updateLead(id: string, updates: Partial<Omit<Lead, 'id' | 'createdAt'>>): Lead | null {
  const leads = getLeads()
  const idx = leads.findIndex(l => l.id === id)
  if (idx === -1) return null
  leads[idx] = { ...leads[idx], ...updates, updatedAt: new Date().toISOString() }
  writeFile('leads.json', leads)
  return leads[idx]
}

// ══════════ CLIENTS ══════════
export interface Client {
  id: string
  name: string
  business: string
  email: string
  phone?: string
  industry?: string
  packageTier: 'social_essentials' | 'spark' | 'growth' | 'scale'
  monthlyPrice: number
  startDate: string
  status: 'active' | 'paused' | 'churned'
  notes: string
  deliverables: string[]
  quickWins: { text: string; done: boolean }[]
  createdAt: string
  updatedAt: string
}

export function getClients(): Client[] {
  return readFile<Client[]>('clients.json', [])
}

export function getClientById(id: string): Client | undefined {
  return getClients().find(c => c.id === id)
}

export function createClient(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Client {
  const clients = getClients()
  const client: Client = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  clients.push(client)
  writeFile('clients.json', clients)
  return client
}

export function updateClient(id: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>): Client | null {
  const clients = getClients()
  const idx = clients.findIndex(c => c.id === id)
  if (idx === -1) return null
  clients[idx] = { ...clients[idx], ...updates, updatedAt: new Date().toISOString() }
  writeFile('clients.json', clients)
  return clients[idx]
}

// ══════════ MESSAGES ══════════
export interface Message {
  id: string
  clientId: string
  fromRole: 'admin' | 'client'
  fromName: string
  text: string
  createdAt: string
}

export function getMessages(clientId?: string): Message[] {
  const messages = readFile<Message[]>('messages.json', [])
  return clientId ? messages.filter(m => m.clientId === clientId) : messages
}

export function createMessage(data: Omit<Message, 'id' | 'createdAt'>): Message {
  const messages = readFile<Message[]>('messages.json', [])
  const msg: Message = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  messages.push(msg)
  writeFile('messages.json', messages)
  return msg
}

// ══════════ ADMIN PERSISTENT DATA (roadmap tasks, positioning canvas, etc.) ══════════
export interface AdminData {
  roadmapTasks: Record<string, boolean> // taskId -> done
  positioningCanvas: Record<string, string> // field -> text
  weeklyActivity: Record<string, number> // metric -> count
}

export function getAdminData(): AdminData {
  return readFile<AdminData>('admin-data.json', {
    roadmapTasks: {},
    positioningCanvas: {},
    weeklyActivity: {},
  })
}

export function updateAdminData(updates: Partial<AdminData>): AdminData {
  const data = getAdminData()
  const merged = { ...data, ...updates }
  writeFile('admin-data.json', merged)
  return merged
}

// ══════════ SEED DEFAULT ADMIN ══════════
export function seedAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'sales@sundayharmony.com'
    const adminPass = process.env.ADMIN_PASSWORD || 'sundayharmony2025'
    const existing = getUserByEmail(adminEmail)
    if (!existing) {
      createUser({
        email: adminEmail,
        password: adminPass,
        name: 'Mac Cesar',
        role: 'admin',
      })
      console.log(`Admin account created: ${adminEmail}`)
    }
  } catch (err) {
    console.error('Failed to seed admin (this is expected on first Vercel cold start):', err)
  }
}
