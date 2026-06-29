'use client'

import { useCallback, useEffect, useState } from 'react'

interface CreditExpert {
  id: string
  name: string
  email: string
  role: string
  created_at?: string
}

type ExpertForm = { name: string; email: string }

const emptyForm: ExpertForm = { name: '', email: '' }

export default function CreditExpertsPanel({ defaultExpanded = false }: { defaultExpanded?: boolean }) {
  const [experts, setExperts] = useState<CreditExpert[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<ExpertForm>(emptyForm)
  const [editExpert, setEditExpert] = useState<CreditExpert | null>(null)
  const [editForm, setEditForm] = useState<ExpertForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const loadExperts = useCallback(async () => {
    const res = await fetch('/api/admin/staff-users')
    if (res.ok) {
      setExperts(await res.json())
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const sessionRes = await fetch('/api/auth/session')
        if (!sessionRes.ok) return
        const data = await sessionRes.json()
        const admin = data?.user?.role === 'admin'
        setIsAdmin(admin)
        if (admin) await loadExperts()
      } finally {
        setLoading(false)
      }
    })()
  }, [loadExperts])

  if (loading || !isAdmin) return null

  const inputClass = 'w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm'

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/staff-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add expert')
      setExperts((prev) => [...prev, data])
      setAddForm(emptyForm)
      setShowAddForm(false)
      setNotice(
        data.emailSent
          ? `Setup email sent to ${data.email}`
          : data.warning || `Expert added — send setup email manually`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editExpert) return
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/staff-users/${editExpert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update expert')
      setExperts((prev) => prev.map((ex) => (ex.id === data.id ? data : ex)))
      setEditExpert(null)
      setNotice(`Updated ${data.name}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (expert: CreditExpert) => {
    if (!window.confirm(`Remove ${expert.name} (${expert.email})? They will lose panel access.`)) return
    setError('')
    setNotice('')
    setBusyId(expert.id)
    try {
      const res = await fetch(`/api/admin/staff-users/${expert.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove expert')
      setExperts((prev) => prev.filter((ex) => ex.id !== expert.id))
      setNotice(`Removed ${expert.name}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyId(null)
    }
  }

  const handleSendSetup = async (expert: CreditExpert) => {
    setError('')
    setNotice('')
    setBusyId(expert.id)
    try {
      const res = await fetch(`/api/admin/staff-users/${expert.id}/send-setup`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send setup email')
      setNotice(`Password setup email sent to ${expert.email}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mb-6 border border-brand-border rounded-xl bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-neutral-50 transition-colors"
      >
        <div>
          <h2 className="text-sm font-bold text-brand-text">Credit Experts</h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Add, edit, or remove experts and send password setup emails from here
          </p>
        </div>
        <span className="text-xs font-semibold text-brand-dim">{expanded ? 'Hide' : 'Manage'}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-brand-border">
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-brand-red">{error}</div>
          )}
          {notice && (
            <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">{notice}</div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm((v) => !v)
                setAddForm(emptyForm)
                setError('')
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-brand-text text-white rounded-lg hover:bg-neutral-800"
            >
              {showAddForm ? 'Cancel add' : 'Add expert'}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAdd} className="mt-4 p-4 bg-neutral-50 rounded-xl border border-brand-border space-y-3 max-w-md">
              <p className="text-xs text-brand-muted">
                A password setup email with a one-time code will be sent automatically.
              </p>
              <div>
                <label className="block text-xs font-semibold text-brand-dim mb-1">Full name</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-dim mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-50"
              >
                {submitting ? 'Adding…' : 'Add & send setup email'}
              </button>
            </form>
          )}

          {experts.length === 0 ? (
            <p className="mt-4 text-sm text-brand-dim">No credit experts yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {experts.map((expert) => (
                <li
                  key={expert.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 rounded-lg border border-brand-border"
                >
                  <div>
                    <p className="text-sm font-semibold text-brand-text">{expert.name}</p>
                    <p className="text-xs text-brand-muted">{expert.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === expert.id}
                      onClick={() => handleSendSetup(expert)}
                      className="px-3 py-1.5 text-xs font-semibold bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      {busyId === expert.id ? 'Sending…' : 'Send setup email'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === expert.id}
                      onClick={() => {
                        setEditExpert(expert)
                        setEditForm({ name: expert.name, email: expert.email })
                        setError('')
                      }}
                      className="px-3 py-1.5 text-xs font-semibold border border-brand-border rounded-lg hover:bg-white disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === expert.id}
                      onClick={() => handleRemove(expert)}
                      className="px-3 py-1.5 text-xs font-semibold text-brand-red border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editExpert && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-white border border-brand-border rounded-xl shadow-xl p-6">
            <h3 className="text-lg font-bold text-brand-text mb-4">Edit credit expert</h3>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-dim mb-1">Full name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-dim mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditExpert(null)}
                  className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
