/** One person per email, built from the records that already exist. */

export type PersonLead = {
  id: string
  first_name: string
  last_name?: string | null
  email?: string | null
  phone?: string | null
  business?: string | null
  client_id?: string | null
  created_at: string
}

export type PersonClient = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  business?: string | null
  lead_id?: string | null
  billing_status?: string | null
  repair_fee_cents?: number | null
  repair_fee_paid_at?: string | null
  created_at: string
}

export type PersonApplication = {
  id: string
  email?: string | null
  full_name?: string | null
  phone?: string | null
  business_name?: string | null
  status?: string | null
  lead_id?: string | null
  client_id?: string | null
  created_at: string
}

export type PersonBooking = {
  id: string
  guest_name?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  business?: string | null
  starts_at: string
  meet_link?: string | null
  status?: string | null
  lead_id?: string | null
  created_at: string
}

export type PeopleInput = {
  leads: PersonLead[]
  clients: PersonClient[]
  applications: PersonApplication[]
  bookings: PersonBooking[]
}

export type PersonSummary = {
  id: string
  email: string
  name: string
  business: string
  phone: string
  createdAt: string
  hasCreditWork: boolean
  clientId: string | null
  leadId: string | null
  applicationId: string | null
  owesMoney: boolean
  oweLabel: string
  applicationStatus: string | null
  nextConsultationAt: string | null
  memberIds: string[]
}

export type PersonScope = 'all' | 'credit'

export const WAITING_APPLICATION_STATUSES = [
  'submitted',
  'documents_pending',
  'under_review',
  'additional_information_requested',
] as const

export type TodayConsultation = {
  personId: string
  name: string
  email: string
  startsAt: string
  meetLink: string | null
  bookingId: string
}

export type TodayApplication = {
  personId: string
  name: string
  email: string
  status: string
  applicationId: string
}

export type TodayOwe = {
  personId: string
  name: string
  email: string
  oweLabel: string
}

export type TodayReferral = {
  personId: string
  name: string
  email: string
  availableCents: number
  clientId: string
}

export type TodayQueue = {
  role: 'admin' | 'credit_manager'
  consultations: TodayConsultation[]
  applications: TodayApplication[]
  owes: TodayOwe[]
  referrals: TodayReferral[]
}

export function normalizePersonEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase()
}

export function personOwesMoney(client: {
  billing_status?: string | null
  repair_fee_cents?: number | null
  repair_fee_paid_at?: string | null
} | null | undefined): boolean {
  if (!client) return false
  if (client.billing_status === 'past_due' || client.billing_status === 'unpaid') return true
  const fee = client.repair_fee_cents ?? 0
  return fee > 0 && !client.repair_fee_paid_at
}

function text(value?: string | null): string {
  return (value || '').trim()
}

function earliest<T extends { id: string; created_at: string }>(rows: T[]): T | undefined {
  if (rows.length === 0) return undefined
  return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))[0]
}

function latest<T extends { created_at: string }>(rows: T[]): T | undefined {
  if (rows.length === 0) return undefined
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
}

function oweLabelFor(clients: PersonClient[]): string {
  const labels: string[] = []
  const seen = new Set<string>()
  const add = (label: string) => {
    if (seen.has(label)) return
    seen.add(label)
    labels.push(label)
  }
  for (const client of clients) {
    if (client.billing_status === 'past_due') add('Past due')
    if (client.billing_status === 'unpaid') add('Unpaid')
    if ((client.repair_fee_cents ?? 0) > 0 && !client.repair_fee_paid_at) add('Repair fee unpaid')
  }
  return labels.join(' · ')
}

type Bucket = {
  key: string
  email: string
  leads: PersonLead[]
  clients: PersonClient[]
  applications: PersonApplication[]
  bookings: PersonBooking[]
}

function bucketFor(map: Map<string, Bucket>, email: string, fallbackKey: string): Bucket {
  const key = email || fallbackKey
  const existing = map.get(key)
  if (existing) return existing
  const created: Bucket = {
    key,
    email,
    leads: [],
    clients: [],
    applications: [],
    bookings: [],
  }
  map.set(key, created)
  return created
}

export function groupPeople(input: PeopleInput, now = new Date()): PersonSummary[] {
  const map = new Map<string, Bucket>()

  for (const lead of input.leads) {
    const email = normalizePersonEmail(lead.email)
    bucketFor(map, email, `lead:${lead.id}`).leads.push(lead)
  }
  for (const client of input.clients) {
    const email = normalizePersonEmail(client.email)
    bucketFor(map, email, `client:${client.id}`).clients.push(client)
  }
  for (const application of input.applications) {
    const email = normalizePersonEmail(application.email)
    bucketFor(map, email, `application:${application.id}`).applications.push(application)
  }
  for (const booking of input.bookings) {
    const email = normalizePersonEmail(booking.guest_email)
    bucketFor(map, email, `booking:${booking.id}`).bookings.push(booking)
  }

  const nowMs = now.getTime()
  const people: PersonSummary[] = []

  for (const bucket of map.values()) {
    const client = earliest(bucket.clients)
    const lead = earliest(bucket.leads)
    const application = earliest(bucket.applications)
    const booking = earliest(bucket.bookings)
    const id = client?.id || lead?.id || application?.id || booking?.id
    if (!id) continue

    const recentApplication = latest(bucket.applications)
    const leadName = lead ? text(`${text(lead.first_name)} ${text(lead.last_name)}`) : ''
    const name =
      text(client?.name) ||
      leadName ||
      text(recentApplication?.full_name) ||
      text(latest(bucket.bookings)?.guest_name) ||
      'Unnamed'
    const business =
      text(client?.business) ||
      text(lead?.business) ||
      text(recentApplication?.business_name) ||
      text(latest(bucket.bookings)?.business)
    const phone =
      text(client?.phone) ||
      text(lead?.phone) ||
      text(latest(bucket.bookings)?.guest_phone) ||
      text(recentApplication?.phone)

    const createdAt = earliest(
      [
        ...bucket.leads,
        ...bucket.clients,
        ...bucket.applications,
        ...bucket.bookings,
      ].map((row) => ({ id: row.id, created_at: row.created_at }))
    )?.created_at || client?.created_at || lead?.created_at || ''

    const nextConsultation = bucket.bookings
      .filter((row) => (row.status || 'scheduled') === 'scheduled' && new Date(row.starts_at).getTime() >= nowMs)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]

    const memberIds = [
      ...bucket.leads.map((row) => row.id),
      ...bucket.clients.map((row) => row.id),
      ...bucket.applications.map((row) => row.id),
      ...bucket.bookings.map((row) => row.id),
    ]

    people.push({
      id,
      email: bucket.email,
      name,
      business,
      phone,
      createdAt,
      hasCreditWork: bucket.applications.length > 0,
      clientId: client?.id ?? null,
      leadId: lead?.id ?? null,
      applicationId: recentApplication?.id ?? null,
      owesMoney: bucket.clients.some((row) => personOwesMoney(row)),
      oweLabel: oweLabelFor(bucket.clients),
      applicationStatus: recentApplication?.status ?? null,
      nextConsultationAt: nextConsultation?.starts_at ?? null,
      memberIds: [...new Set(memberIds)],
    })
  }

  people.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name))
  return people
}

export function filterPeople(people: PersonSummary[], scope: PersonScope): PersonSummary[] {
  if (scope === 'credit') return people.filter((person) => person.hasCreditWork)
  return people
}

export function findPersonById(people: PersonSummary[], id: string): PersonSummary | undefined {
  const key = id.trim()
  if (!key) return undefined
  return people.find((person) => person.id === key || person.memberIds.includes(key))
}

function personForRecord(people: PersonSummary[], recordId: string, email: string): PersonSummary | undefined {
  return (
    people.find((person) => person.memberIds.includes(recordId)) ||
    people.find((person) => person.email && person.email === normalizePersonEmail(email))
  )
}

export function selectUpcomingConsultations(
  people: PersonSummary[],
  bookings: PersonBooking[],
  now = new Date(),
  withinDays = 7
): TodayConsultation[] {
  const start = now.getTime()
  const end = start + withinDays * 24 * 60 * 60 * 1000
  return bookings
    .filter((booking) => {
      if ((booking.status || 'scheduled') !== 'scheduled') return false
      const when = new Date(booking.starts_at).getTime()
      return when >= start && when <= end
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .flatMap((booking) => {
      const person = personForRecord(people, booking.id, booking.guest_email || '')
      if (!person) return []
      return [{
        personId: person.id,
        name: person.name || text(booking.guest_name) || 'Consultation',
        email: person.email || normalizePersonEmail(booking.guest_email),
        startsAt: booking.starts_at,
        meetLink: booking.meet_link || null,
        bookingId: booking.id,
      }]
    })
}

export function selectWaitingApplications(
  people: PersonSummary[],
  applications: PersonApplication[]
): TodayApplication[] {
  const waiting = new Set<string>(WAITING_APPLICATION_STATUSES)
  return applications
    .filter((application) => waiting.has(application.status || ''))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .flatMap((application) => {
      const person = personForRecord(people, application.id, application.email || '')
      if (!person) return []
      return [{
        personId: person.id,
        name: person.name || text(application.full_name) || 'Application',
        email: person.email || normalizePersonEmail(application.email),
        status: application.status || '',
        applicationId: application.id,
      }]
    })
}

export function selectPeopleWhoOwe(people: PersonSummary[]): TodayOwe[] {
  return people
    .filter((person) => person.owesMoney)
    .map((person) => ({
      personId: person.id,
      name: person.name,
      email: person.email,
      oweLabel: person.oweLabel,
    }))
}

const WAITING_STATUS_SET = new Set<string>(WAITING_APPLICATION_STATUSES)

export function applicationIsWaiting(status?: string | null): boolean {
  return WAITING_STATUS_SET.has(status || '')
}

/** One home for each person when the list is grouped. Urgent work wins. */
export const PEOPLE_LANES = ['owes', 'waiting', 'consultation', 'credit', 'client', 'contact'] as const
export type PeopleLane = (typeof PEOPLE_LANES)[number]
export type PeopleFilter = 'all' | PeopleLane
export type PeopleSort = 'newest' | 'name' | 'consultation'

export type PeopleAnalytics = {
  total: number
  owes: number
  waiting: number
  consultations: number
  credit: number
  clients: number
  contacts: number
}

export function personLane(person: PersonSummary, scope: PersonScope = 'all'): PeopleLane {
  if (person.owesMoney) return 'owes'
  if (applicationIsWaiting(person.applicationStatus)) return 'waiting'
  if (scope !== 'credit' && person.nextConsultationAt) return 'consultation'
  if (person.hasCreditWork) return 'credit'
  if (person.clientId) return 'client'
  return 'contact'
}

export function personMatchesFilter(
  person: PersonSummary,
  filter: PeopleFilter,
  scope: PersonScope = 'all'
): boolean {
  if (filter === 'all') return true
  return personLane(person, scope) === filter
}

export function sortPeople(people: PersonSummary[], sort: PeopleSort): PersonSummary[] {
  const rows = [...people]
  if (sort === 'name') {
    rows.sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email))
    return rows
  }
  if (sort === 'consultation') {
    rows.sort((a, b) => {
      if (a.nextConsultationAt && b.nextConsultationAt) return a.nextConsultationAt.localeCompare(b.nextConsultationAt)
      if (a.nextConsultationAt) return -1
      if (b.nextConsultationAt) return 1
      return a.name.localeCompare(b.name)
    })
    return rows
  }
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name))
  return rows
}

export function summarizePeople(people: PersonSummary[], scope: PersonScope = 'all'): PeopleAnalytics {
  const lanes = people.map((person) => personLane(person, scope))
  const count = (lane: PeopleLane) => lanes.filter((item) => item === lane).length
  return {
    total: people.length,
    owes: count('owes'),
    waiting: count('waiting'),
    consultations: count('consultation'),
    credit: count('credit'),
    clients: count('client'),
    contacts: count('contact'),
  }
}

export function groupPeopleByLane(
  people: PersonSummary[],
  sort: PeopleSort,
  scope: PersonScope = 'all'
): { lane: PeopleLane; people: PersonSummary[] }[] {
  const lanes = scope === 'credit'
    ? (['owes', 'waiting', 'credit'] as const)
    : PEOPLE_LANES
  return lanes.flatMap((lane) => {
    const rows = sortPeople(people.filter((person) => personLane(person, scope) === lane), sort)
    if (rows.length === 0) return []
    return [{ lane, people: rows }]
  })
}

export function selectReferralPayouts(
  people: PersonSummary[],
  rows: { clientId: string; name?: string; email?: string; availableCents: number }[]
): TodayReferral[] {
  return rows
    .filter((row) => row.availableCents > 0 && row.clientId)
    .flatMap((row) => {
      const person =
        people.find((item) => item.clientId === row.clientId || item.id === row.clientId) ||
        people.find((item) => item.email && item.email === normalizePersonEmail(row.email))
      return [{
        personId: person?.id || row.clientId,
        name: person?.name || text(row.name) || 'Client',
        email: person?.email || normalizePersonEmail(row.email),
        availableCents: row.availableCents,
        clientId: row.clientId,
      }]
    })
}
