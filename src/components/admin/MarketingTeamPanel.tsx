'use client'

import { useCallback, useEffect, useState } from 'react'

const ROLES = [
  { value: 'lead_procurement', label: 'Lead procurement' },
  { value: 'sales_closer', label: 'Sales closer' },
  { value: 'client_relations', label: 'Client relations' },
] as const

type Member = { id: string; name: string; email: string; role: string }

export default function MarketingTeamPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<(typeof ROLES)[number]['value']>('lead_procurement')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/staff-users?team=marketing')
    if (res.ok) setMembers(await res.json())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addMember(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/staff-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not add this person')
      setName('')
      setEmail('')
      setNotice(data.emailSent ? `Setup email sent to ${data.email}` : data.warning || 'Account created')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this person')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm'

  return (
    <section>
      <h2 className="text-sm font-bold text-brand-text mb-1">Marketing team</h2>
      <p className="text-xs text-brand-muted mb-3">
        Lead procurement, sales, and client relations. Each person only sees their part of the pipeline.
      </p>
      {error && <p className="text-sm text-brand-red mb-2">{error}</p>}
      {notice && <p className="text-sm text-brand-muted mb-2">{notice}</p>}
      <ul className="space-y-2 mb-4">
        {members.map((member) => (
          <li key={member.id} className="text-sm text-brand-text">
            {member.name} · {member.email}
            <span className="text-brand-muted"> · {ROLES.find((item) => item.value === member.role)?.label || member.role}</span>
          </li>
        ))}
        {members.length === 0 && <li className="text-sm text-brand-muted">No marketing logins yet. You can do all three jobs as admin.</li>}
      </ul>
      <form onSubmit={addMember} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-sm">
          Name
          <input className={`${inputClass} mt-1`} required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="text-sm">
          Email
          <input type="email" className={`${inputClass} mt-1`} required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">
          Role
          <select className={`${inputClass} mt-1`} value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            {ROLES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <div>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-60">
            {saving ? 'Adding…' : 'Send setup email'}
          </button>
        </div>
      </form>
    </section>
  )
}
