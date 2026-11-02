'use client'

import { useEffect, useState } from 'react'
import { emptyOnboarding, type OnboardingChecklist } from '@/lib/marketing-pipeline'

type WonClient = {
  id: string
  business: string
  contactName: string
  email: string
  expectations: string
  notes: string
  onboarding: OnboardingChecklist
  driveFolderUrl: string | null
  proposalDocUrl: string | null
  paymentStatus: string
  clientId: string | null
}

const CHECKS: { key: keyof OnboardingChecklist; label: string }[] = [
  { key: 'welcomed', label: 'Welcomed the client' },
  { key: 'assets', label: 'Brand assets collected' },
  { key: 'access', label: 'Access collected' },
  { key: 'requirements', label: 'Requirements collected' },
  { key: 'expectations', label: 'Expectations and timeline set' },
]

export default function ClientRelationsBoard() {
  const [clients, setClients] = useState<WonClient[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [workspaceConnected, setWorkspaceConnected] = useState(false)
  const [tasks, setTasks] = useState<Record<string, { id: string; title: string; status: string; due_date: string | null }[]>>({})
  const [taskTitle, setTaskTitle] = useState('')

  async function load() {
    const res = await fetch('/api/admin/relations')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Could not load clients.')
      return
    }
    setClients(data.prospects || [])
    setWorkspaceConnected(Boolean(data.workspaceConnected))
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const client = clients.find((row) => row.id === openId)
    if (!client?.clientId || tasks[client.clientId]) return
    void fetch(`/api/admin/tasks?client_id=${encodeURIComponent(client.clientId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTasks((current) => ({ ...current, [client.clientId as string]: data }))
        }
      })
      .catch(() => undefined)
  }, [openId, clients, tasks])

  async function save(client: WonClient) {
    setError('')
    setNotice('')
    const res = await fetch(`/api/admin/relations/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        onboarding: client.onboarding,
        expectations: client.expectations,
        notes: client.notes,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Could not save')
      return
    }
    setNotice('Onboarding saved.')
    await load()
  }

  async function upload(clientId: string, file: File) {
    const body = new FormData()
    body.set('file', file)
    const res = await fetch(`/api/admin/relations/${clientId}`, { method: 'POST', body })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Upload failed')
      return
    }
    setNotice('File added to the Drive folder.')
    await load()
  }

  return (
    <section className="mb-8">
      <h2 className="font-serif text-2xl font-extrabold text-brand-text mb-1">Client relations</h2>
      <p className="text-sm text-brand-muted mb-4">
        Won marketing clients. Collect assets, set the timeline, and keep the Drive folder current.
      </p>
      {error && <p className="text-sm text-brand-red mb-2">{error}</p>}
      {notice && <p className="text-sm text-brand-muted mb-2">{notice}</p>}
      {!workspaceConnected && (
        <p className="text-sm text-brand-muted mb-3">Drive uploads stay off until Google Workspace is connected.</p>
      )}
      {clients.length === 0 && <p className="text-sm text-brand-muted">No won clients yet.</p>}
      <div className="space-y-3">
        {clients.map((client) => {
          const open = openId === client.id
          return (
            <article key={client.id} className="bg-white border border-brand-border rounded-xl p-4">
              <button type="button" className="w-full text-left" onClick={() => setOpenId(open ? null : client.id)}>
                <div className="text-sm font-semibold text-brand-text">{client.business}</div>
                <div className="text-xs text-brand-muted">{client.contactName || client.email} · Payment {client.paymentStatus || 'not recorded'}</div>
              </button>
              {open && (
                <div className="mt-3 space-y-3">
                  {CHECKS.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(client.onboarding?.[item.key])}
                        onChange={(event) => {
                          setClients((rows) => rows.map((row) => row.id === client.id
                            ? { ...row, onboarding: { ...emptyOnboarding(), ...row.onboarding, [item.key]: event.target.checked } }
                            : row))
                        }}
                      />
                      {item.label}
                    </label>
                  ))}
                  <label className="block text-sm">
                    Expectations
                    <textarea
                      className="mt-1 w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
                      rows={2}
                      value={client.expectations}
                      onChange={(event) => setClients((rows) => rows.map((row) => row.id === client.id ? { ...row, expectations: event.target.value } : row))}
                    />
                  </label>
                  <label className="block text-sm">
                    Notes for renewals and referrals
                    <textarea
                      className="mt-1 w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
                      rows={2}
                      value={client.notes}
                      onChange={(event) => setClients((rows) => rows.map((row) => row.id === client.id ? { ...row, notes: event.target.value } : row))}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2 items-center">
                    <button type="button" onClick={() => void save(client)} className="px-3 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg">
                      Save
                    </button>
                    <label className="text-sm">
                      <span className="sr-only">Upload asset</span>
                      <input
                        type="file"
                        disabled={!workspaceConnected}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void upload(client.id, file)
                        }}
                      />
                    </label>
                    {client.clientId && (
                      <form
                        className="flex flex-wrap gap-2 items-end"
                        onSubmit={(event) => {
                          event.preventDefault()
                          const title = taskTitle.trim()
                          if (!title || !client.clientId) return
                          void fetch('/api/admin/tasks', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ client_id: client.clientId, title, category: 'milestone' }),
                          }).then(async (res) => {
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}))
                              setError(data.error || 'Could not add the milestone')
                              return
                            }
                            setTaskTitle('')
                            setTasks((current) => {
                              const next = { ...current }
                              delete next[client.clientId as string]
                              return next
                            })
                          })
                        }}
                      >
                        <label className="text-sm flex-1 min-w-[12rem]">
                          Milestone
                          <input className="mt-1 w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
                        </label>
                        <button type="submit" className="px-3 py-2 text-sm font-semibold border border-brand-border rounded-lg">Add</button>
                      </form>
                    )}
                    {client.clientId && (tasks[client.clientId] || []).length > 0 && (
                      <ul className="text-sm text-brand-muted space-y-1">
                        {(tasks[client.clientId] || []).map((task) => (
                          <li key={task.id}>{task.title} · {task.status.replace(/_/g, ' ')}{task.due_date ? ` · due ${task.due_date}` : ''}</li>
                        ))}
                      </ul>
                    )}
                    {client.driveFolderUrl && <a className="text-sm text-accent" href={client.driveFolderUrl} target="_blank" rel="noreferrer">Drive folder</a>}
                    {client.proposalDocUrl && <a className="text-sm text-accent" href={client.proposalDocUrl} target="_blank" rel="noreferrer">Proposal</a>}
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
