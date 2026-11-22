'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import MarketingPipeline from '@/components/admin/MarketingPipeline'
import OutreachConsole from '@/components/admin/OutreachConsole'
import ClientsPage from '@/app/admin/clients/page'
import type { MarketingKpiView } from '@/lib/marketing-pipeline'

type DeskPerson = {
  id: string
  business: string
  contactName: string
  email: string
  stage: string
  stageLabel: string
  deadline: string
  deliverables: string
  clientId: string | null
  consultationBookedAt: string | null
  repliedAt: string | null
}

type DeskTask = {
  id: string
  clientId: string
  title: string
  status: string
  dueDate: string | null
}

type DeskPayload = {
  role: string
  kpis: MarketingKpiView
  replies: DeskPerson[]
  leads: DeskPerson[]
  clients: DeskPerson[]
  deadlines: DeskPerson[]
  tasks: DeskTask[]
  error?: string
}

const SECTIONS = [
  { id: 'replies', label: 'Replies' },
  { id: 'leads', label: 'Leads' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'clients', label: 'Clients' },
  { id: 'deadlines', label: 'Deadlines' },
  { id: 'kpis', label: 'KPIs' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function isSection(value: string | null): value is SectionId {
  return SECTIONS.some((section) => section.id === value)
}

export default function MarketingDesk() {
  const params = useSearchParams()
  const requested = params.get('section')
  const [data, setData] = useState<DeskPayload | null>(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkNote, setCheckNote] = useState('')

  const load = () =>
    fetch('/api/admin/marketing')
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || 'Could not load the marketing desk')
        setData(body)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the marketing desk'))

  useEffect(() => {
    void load()
  }, [])

  const checkReplies = async () => {
    setChecking(true)
    setCheckNote('')
    try {
      const res = await fetch('/api/admin/marketing', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not check replies')
      setCheckNote(`Checked ${body.checked} threads. ${body.replied} new replies.${body.failed ? ` ${body.failed} could not be read.` : ''}`)
      await load()
    } catch (err) {
      setCheckNote(err instanceof Error ? err.message : 'Could not check replies')
    } finally {
      setChecking(false)
    }
  }

  const role = data?.role || ''
  const sections = SECTIONS.filter((section) => section.id !== 'outreach' || role !== 'client_relations')
  const section: SectionId = isSection(requested) && sections.some((item) => item.id === requested)
    ? requested
    : 'replies'

  return (
    <div>
      <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Marketing</h1>
      <p className="text-sm text-brand-muted mb-4">Leads, outreach, pipeline, clients, and deadlines for marketing clients.</p>
      <nav className="flex flex-wrap gap-2 mb-6" aria-label="Marketing">
        {sections.map((item) => {
          const active = item.id === section
          return (
            <Link
              key={item.id}
              href={`/admin/marketing?section=${item.id}`}
              className={`inline-flex min-h-11 items-center px-3 py-2 rounded-lg text-sm font-semibold border ${
                active
                  ? 'bg-accent-soft border-brand-border text-brand-text'
                  : 'bg-white border-brand-border text-brand-muted'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
      {section === 'replies' && (
        <div>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void checkReplies()}
              disabled={checking}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-text disabled:opacity-60"
            >
              {checking ? 'Checking Gmail…' : 'Check replies now'}
            </button>
            <p className="text-sm text-brand-muted">{checkNote || 'Gmail is also checked once a day. Answer every reply the same day.'}</p>
          </div>
          <PersonList people={data?.replies || []} empty="No replies recorded yet." showReplied />
        </div>
      )}
      {section === 'leads' && <PersonList people={data?.leads || []} empty="No open leads." />}
      {section === 'outreach' && <OutreachConsole />}
      {section === 'pipeline' && <MarketingPipeline />}
      {section === 'clients' && <ClientsPage />}
      {section === 'deadlines' && (
        <DeadlineList people={data?.deadlines || []} tasks={data?.tasks || []} />
      )}
      {section === 'kpis' && <KpiPanel kpis={data?.kpis || null} />}
    </div>
  )
}

function PersonList({ people, empty, showReplied = false }: { people: DeskPerson[]; empty: string; showReplied?: boolean }) {
  if (people.length === 0) return <p className="text-sm text-brand-muted">{empty}</p>
  return (
    <ul className="space-y-3">
      {people.map((person) => (
        <li key={person.id} className="rounded-xl border border-brand-border bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-brand-text">{person.business}</p>
              <p className="text-sm text-brand-muted">{[person.contactName, person.email].filter(Boolean).join(' · ') || 'No contact yet'}</p>
              <p className="text-xs text-brand-muted mt-1">
                {person.stageLabel}
                {showReplied && person.repliedAt ? ` · replied ${new Date(person.repliedAt).toLocaleString()}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/admin/pipeline/${person.id}`} className="text-sm font-semibold text-accent hover:underline">Open lead</Link>
              {person.clientId && (
                <Link href={`/admin/clients?client=${person.clientId}`} className="text-sm font-semibold text-accent hover:underline">Open client</Link>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function DeadlineList({ people, tasks }: { people: DeskPerson[]; tasks: DeskTask[] }) {
  if (people.length === 0) return <p className="text-sm text-brand-muted">No deadlines yet. A closed lead with a deadline shows up here.</p>
  return (
    <ul className="space-y-3">
      {people.map((person) => {
        const rows = tasks.filter((task) => task.clientId === person.clientId)
        return (
          <li key={person.id} className="rounded-xl border border-brand-border bg-white p-4">
            <p className="font-semibold text-brand-text">{person.business}</p>
            <p className="text-sm text-brand-muted mt-1">Deadline: {person.deadline || 'Not set'}</p>
            <p className="text-sm text-brand-text mt-2 whitespace-pre-wrap">{person.deliverables || 'No deliverables yet'}</p>
            {rows.length > 0 && (
              <ul className="mt-3 space-y-1">
                {rows.map((task) => (
                  <li key={task.id} className="text-sm text-brand-muted">
                    {task.title}{task.dueDate ? ` · due ${task.dueDate}` : ''} · {task.status.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href={`/admin/pipeline/${person.id}`} className="text-sm font-semibold text-accent hover:underline">Open lead</Link>
              {person.clientId && (
                <Link href={`/admin/clients?client=${person.clientId}`} className="text-sm font-semibold text-accent hover:underline">Open client</Link>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function KpiPanel({ kpis }: { kpis: MarketingKpiView | null }) {
  if (!kpis) return <p className="text-sm text-brand-muted">Loading KPIs…</p>
  const tiles = [
    { label: 'Lead volume', value: String(kpis.leadVolume), detail: 'Marketing leads on file' },
    { label: 'Response rate', value: kpis.responseRate, detail: `${kpis.responsesRecorded} recorded replies of ${kpis.emailsSent} emails` },
    { label: 'Consultations booked', value: String(kpis.consultationsBooked), detail: 'Saved consultation dates only' },
    { label: 'Close rate', value: kpis.closeRate, detail: `${kpis.closed} closed of ${kpis.leadVolume} leads` },
    { label: 'Cost per lead', value: kpis.costPerLead, detail: 'Unavailable until ad spend is connected' },
    { label: 'Revenue', value: kpis.revenue, detail: 'Paid marketing clients only' },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-brand-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{tile.label}</p>
          <p className="mt-2 text-2xl font-semibold text-brand-text">{tile.value}</p>
          <p className="mt-1 text-sm text-brand-muted">{tile.detail}</p>
        </div>
      ))}
    </div>
  )
}
