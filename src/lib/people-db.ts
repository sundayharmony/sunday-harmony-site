import { getSupabase } from './supabase'
import { decryptFieldOrLegacy } from './field-encryption'
import {
  getClients,
  getLeads,
  getClientById,
  updateClient,
  updateLead,
  type Client,
  type Lead,
} from './db'
import {
  getCreditFundingApplicationByClientId,
  getCreditFundingApplicationByEmail,
  getCreditFundingApplications,
} from './credit-funding-db'
import type { CreditFundingApplication } from './credit-funding-types'
import { STATUS_LABELS, type ApplicationStatus } from './credit-funding-types'
import { listScheduledBookings, updateConsultationBooking, type ConsultationBookingRow } from './consultation-db'
import { getAdminReferralOverview } from './referral-service'
import { billingPackageLabel, currentBillingPackage } from './billing-packages'
import { isCreditRepairBillingClient } from './credit-repair-billing'
import {
  filterPeople,
  findPersonById,
  groupPeople,
  selectPeopleWhoOwe,
  selectReferralPayouts,
  selectUpcomingConsultations,
  selectWaitingApplications,
  type PersonApplication,
  type PersonBooking,
  type PersonClient,
  type PersonLead,
  type PersonScope,
  type PersonSummary,
  type TodayQueue,
} from './people'

export type { PersonScope }

export type PersonBookingView = {
  id: string
  startsAt: string
  meetLink: string | null
  note: string
  status: string
}

export type PersonApplicationView = {
  id: string
  status: string
  statusLabel: string
}

export type PersonClientView = {
  id: string
  name: string
  email: string
  business: string
  packageTier: string
  packageLabel: string
  monthlyPrice: number
  status: string
  isPotential: boolean
  deliverables: string[]
  billing: {
    id: string
    name: string
    email?: string
    is_potential?: boolean
    package_tier: string
    monthly_price?: number
    billing_status?: string
    billing_model?: string | null
    lead_type?: string | null
    repair_fee_cents?: number | null
    repair_fee_paid_at?: string | null
    stripe_repair_invoice_id?: string | null
    stripe_customer_id?: string
    stripe_subscription_id?: string
    next_billing_date?: string | null
    last_payment_at?: string | null
  }
}

export type PersonFile = {
  role: 'admin' | 'credit_manager'
  person: PersonSummary
  bookings: PersonBookingView[]
  applications: PersonApplicationView[]
  client: PersonClientView | null
  repairClient: PersonClientView['billing'] | null
  showReferrals: boolean
}

type Loaded = {
  leads: Lead[]
  clients: Client[]
  applications: CreditFundingApplication[]
  bookings: ConsultationBookingRow[]
  people: PersonSummary[]
}

function asLead(lead: Lead): PersonLead {
  return {
    id: lead.id,
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone,
    business: lead.business,
    client_id: lead.client_id,
    created_at: lead.created_at,
  }
}

function asClient(client: Client): PersonClient {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    business: client.business,
    lead_id: client.lead_id,
    billing_status: client.billing_status,
    repair_fee_cents: client.repair_fee_cents,
    repair_fee_paid_at: client.repair_fee_paid_at,
    created_at: client.created_at,
  }
}

function asApplication(app: CreditFundingApplication): PersonApplication {
  return {
    id: app.id,
    email: app.email,
    full_name: app.full_name,
    phone: decryptFieldOrLegacy(app.phone || ''),
    business_name: app.business_name,
    status: app.status,
    lead_id: app.lead_id,
    client_id: app.client_id,
    created_at: app.created_at,
  }
}

function asBooking(booking: ConsultationBookingRow): PersonBooking {
  return {
    id: booking.id,
    guest_name: booking.guest_name,
    guest_email: booking.guest_email,
    guest_phone: booking.guest_phone,
    business: booking.business,
    starts_at: booking.starts_at,
    meet_link: booking.meet_link,
    status: booking.status,
    lead_id: booking.lead_id,
    created_at: booking.created_at,
  }
}

async function loadRecords(now = new Date()): Promise<Loaded> {
  const [leads, clients, applications, bookings] = await Promise.all([
    getLeads(),
    getClients(),
    getCreditFundingApplications({ status: 'all' }),
    listScheduledBookings(),
  ])
  const people = groupPeople(
    {
      leads: leads.map(asLead),
      clients: clients.map(asClient),
      applications: applications.map(asApplication),
      bookings: bookings.map(asBooking),
    },
    now
  )
  return { leads, clients, applications, bookings, people }
}

export async function listPeople(scope: PersonScope = 'all', now = new Date()): Promise<PersonSummary[]> {
  const loaded = await loadRecords(now)
  return filterPeople(loaded.people, scope)
}

export async function findCanonicalPersonId(id: string, scope: PersonScope = 'all'): Promise<string | null> {
  const people = await listPeople(scope)
  return findPersonById(people, id)?.id ?? null
}

function statusLabel(status: string): string {
  if (status in STATUS_LABELS) return STATUS_LABELS[status as ApplicationStatus]
  return status.replace(/_/g, ' ')
}

function toClientView(client: Client): PersonClientView {
  const packageTier = currentBillingPackage(client)
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    business: client.business,
    packageTier,
    packageLabel: billingPackageLabel(packageTier),
    monthlyPrice: client.monthly_price,
    status: client.status,
    isPotential: client.is_potential,
    deliverables: client.deliverables || [],
    billing: {
      id: client.id,
      name: client.name,
      email: client.email,
      is_potential: client.is_potential,
      package_tier: client.package_tier,
      monthly_price: client.monthly_price,
      billing_status: client.billing_status,
      billing_model: client.billing_model,
      lead_type: client.lead_type,
      repair_fee_cents: client.repair_fee_cents,
      repair_fee_paid_at: client.repair_fee_paid_at,
      stripe_repair_invoice_id: client.stripe_repair_invoice_id,
      stripe_customer_id: client.stripe_customer_id,
      stripe_subscription_id: client.stripe_subscription_id,
      next_billing_date: client.next_billing_date,
      last_payment_at: client.last_payment_at,
    },
  }
}

async function linkPersonRecords(person: PersonSummary, loaded: Loaded): Promise<void> {
  const ids = new Set(person.memberIds)
  const leads = loaded.leads.filter((row) => ids.has(row.id))
  const clients = loaded.clients.filter((row) => ids.has(row.id))
  const applications = loaded.applications.filter((row) => ids.has(row.id))
  const bookings = loaded.bookings.filter((row) => ids.has(row.id))
  const client = [...clients].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
  const lead = [...leads].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]

  if (client && lead) {
    if (!lead.client_id) await updateLead(lead.id, { client_id: client.id })
    if (!client.lead_id) await updateClient(client.id, { lead_id: lead.id })
  }

  for (const application of applications) {
    const patch: { lead_id?: string; client_id?: string } = {}
    if (!application.lead_id && lead) patch.lead_id = lead.id
    if (!application.client_id && client) patch.client_id = client.id
    if (Object.keys(patch).length === 0) continue
    const { error } = await getSupabase().from('credit_funding_applications').update(patch).eq('id', application.id)
    if (error) console.error('link application to person error:', error)
  }

  for (const booking of bookings) {
    if (booking.lead_id || !lead) continue
    await updateConsultationBooking(booking.id, { lead_id: lead.id })
  }
}

export async function getPersonFile(
  id: string,
  role: 'admin' | 'credit_manager',
  now = new Date()
): Promise<PersonFile | null> {
  const loaded = await loadRecords(now)
  const scope: PersonScope = role === 'credit_manager' ? 'credit' : 'all'
  const person = findPersonById(filterPeople(loaded.people, scope), id)
  if (!person) return null
  if (role === 'credit_manager' && !person.hasCreditWork) return null

  await linkPersonRecords(person, loaded)

  const ids = new Set(person.memberIds)
  const client = loaded.clients.find((row) => row.id === person.clientId) || null
  const clientView = client ? toClientView(client) : null
  const repair =
    clientView && isCreditRepairBillingClient(clientView.billing) ? clientView.billing : null

  const bookings = role === 'admin'
    ? loaded.bookings
      .filter((row) => ids.has(row.id))
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .map((row) => ({
        id: row.id,
        startsAt: row.starts_at,
        meetLink: row.meet_link,
        note: row.note,
        status: row.status,
      }))
    : []

  const applications = loaded.applications
    .filter((row) => ids.has(row.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((row) => ({
      id: row.id,
      status: row.status,
      statusLabel: statusLabel(row.status),
    }))

  return {
    role,
    person,
    bookings,
    applications,
    client: role === 'admin' ? clientView : null,
    repairClient: role === 'credit_manager' ? repair : null,
    showReferrals: role === 'admin' && Boolean(clientView && isCreditRepairBillingClient(clientView.billing)),
  }
}

export async function loadTodayQueue(
  role: 'admin' | 'credit_manager',
  now = new Date()
): Promise<TodayQueue> {
  const loaded = await loadRecords(now)
  const people = filterPeople(loaded.people, role === 'credit_manager' ? 'credit' : 'all')
  const applications = selectWaitingApplications(people, loaded.applications.map(asApplication))
  if (role === 'credit_manager') {
    return { role, consultations: [], applications, owes: [], referrals: [] }
  }

  let referralRows: { clientId: string; name: string; email: string; availableCents: number }[] = []
  try {
    const overview = await getAdminReferralOverview()
    referralRows = overview.clients.map((row) => ({
      clientId: row.clientId,
      name: row.name,
      email: row.email,
      availableCents: row.availableCents,
    }))
  } catch (error) {
    console.error('today referral payouts error:', error)
  }

  return {
    role,
    consultations: selectUpcomingConsultations(people, loaded.bookings.map(asBooking), now),
    applications,
    owes: selectPeopleWhoOwe(people),
    referrals: selectReferralPayouts(people, referralRows),
  }
}

export async function clientHasCreditWork(clientId: string): Promise<boolean> {
  if (!clientId) return false
  const byClient = await getCreditFundingApplicationByClientId(clientId)
  if (byClient) return true
  const client = await getClientById(clientId)
  if (!client?.email) return false
  const byEmail = await getCreditFundingApplicationByEmail(client.email)
  return Boolean(byEmail)
}

export async function staffMayUseClient(role: string | undefined, clientId: string): Promise<boolean> {
  if (role === 'admin') return true
  if (role !== 'credit_manager') return false
  return clientHasCreditWork(clientId)
}
