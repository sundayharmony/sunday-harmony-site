'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  daysUntilDeadline,
  roundStatusLabel,
  type DisputeResponseRow,
  type DisputeRoundRow,
} from '@/lib/dispute-letters/dispute-lifecycle'

interface DisputesPayload {
  rounds: DisputeRoundRow[]
  responses: DisputeResponseRow[]
}

export default function ClientDisputePanel() {
  const [data, setData] = useState<DisputesPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyRoundId, setBusyRoundId] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<Record<string, File | null>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/credit-funding/disputes')
      if (res.status === 404) {
        setData({ rounds: [], responses: [] })
        setError('')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load dispute packets')
      }
      const body = await res.json()
      setData({
        rounds: Array.isArray(body.rounds) ? body.rounds : [],
        responses: Array.isArray(body.responses) ? body.responses : [],
      })
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dispute packets')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function uploadResponse(roundId: string) {
    const file = pendingFiles[roundId]
    if (!file) return
    setBusyRoundId(roundId)
    try {
      const fd = new FormData()
      fd.append('roundId', roundId)
      fd.append('file', file)
      const res = await fetch('/api/dashboard/credit-funding/disputes', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Upload failed')
      }
      setPendingFiles((prev) => {
        const next = { ...prev }
        delete next[roundId]
        return next
      })
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusyRoundId(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-brand-border rounded-xl p-5 mb-6">
        <p className="text-sm text-brand-dim">Loading dispute packets…</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="bg-white border border-brand-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-bold text-brand-text mb-2">Dispute packets</h3>
        <p className="text-sm text-brand-muted">{error}</p>
      </div>
    )
  }

  const rounds = data?.rounds || []
  if (!rounds.length) return null

  const responsesByRound = new Map<string, DisputeResponseRow[]>()
  for (const response of data?.responses || []) {
    const list = responsesByRound.get(response.round_id) || []
    list.push(response)
    responsesByRound.set(response.round_id, list)
  }

  return (
    <div className="bg-white border border-brand-border rounded-xl p-5 mb-6">
      <h3 className="text-sm font-bold text-brand-text mb-1">Dispute packets</h3>
      <p className="text-xs text-brand-dim mb-4">
        Letters released by your specialist. Upload bureau replies when you receive them.
      </p>
      {error && <p className="text-sm text-brand-red mb-3">{error}</p>}
      <div className="space-y-4">
        {rounds.map((round) => {
          const days = daysUntilDeadline(round.deadline_at)
          const roundResponses = responsesByRound.get(round.id) || []
          return (
            <div
              key={round.id}
              className="p-4 bg-neutral-50 rounded-xl border border-brand-border space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-brand-text">
                    Round {round.round_number}
                  </p>
                  <p className="text-xs text-brand-dim mt-0.5">
                    {roundStatusLabel(round.status)}
                    {round.mailed_at
                      ? ` · mailed ${new Date(round.mailed_at).toLocaleDateString()}`
                      : ''}
                  </p>
                  {round.deadline_at && (
                    <p className="text-xs text-brand-dim mt-0.5">
                      Response window ends {new Date(round.deadline_at).toLocaleDateString()}
                      {days != null
                        ? days >= 0
                          ? ` (${days} day${days === 1 ? '' : 's'} left)`
                          : ` (${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue)`
                        : ''}
                    </p>
                  )}
                </div>
              </div>

              {roundResponses.length > 0 && (
                <ul className="text-xs text-brand-dim space-y-1">
                  {roundResponses.map((r) => (
                    <li key={r.id}>
                      Uploaded: {r.file_name}
                      {r.created_at ? ` · ${new Date(r.created_at).toLocaleString()}` : ''}
                    </li>
                  ))}
                </ul>
              )}

              <div>
                <label className="block text-xs font-medium text-brand-text mb-1">
                  Upload bureau response
                </label>
                <input
                  type="file"
                  disabled={busyRoundId === round.id}
                  onChange={(e) =>
                    setPendingFiles((prev) => ({
                      ...prev,
                      [round.id]: e.target.files?.[0] || null,
                    }))
                  }
                  className="block w-full text-xs text-brand-dim"
                />
                <button
                  type="button"
                  disabled={busyRoundId === round.id || !pendingFiles[round.id]}
                  onClick={() => void uploadResponse(round.id)}
                  className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold border border-brand-border bg-white hover:bg-neutral-50 disabled:opacity-50"
                >
                  {busyRoundId === round.id ? 'Uploading…' : 'Upload response'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
