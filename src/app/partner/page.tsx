'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import BrandLogo from '@/components/BrandLogo'
import StatCard from '@/components/ui/StatCard'

type CurrentScores = {
  transunion: number | null
  experian: number | null
  equifax: number | null
}

type ReferralRow = {
  id: string
  date: string
  applicant: string
  stage: string
  updatedAt: string
  disputeRound: number | null
  currentScores: CurrentScores | null
}

function CurrentScoresCell({ scores }: { scores: CurrentScores | null }) {
  if (!scores) return <span className="text-brand-dim">—</span>
  const lines = [
    ['TransUnion', scores.transunion],
    ['Experian', scores.experian],
    ['Equifax', scores.equifax],
  ] as const
  return (
    <div className="space-y-0.5 min-w-[8.5rem]">
      {lines.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-brand-dim">{label}</span>
          <span className="font-semibold tabular-nums text-brand-text">{value ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}

type DashboardPayload = {
  profile: {
    name: string
    companyName: string
    serviceArea: string
    profession: string
    yearsInField: number
    status: string
    code: string
    link: string
    linkActive: boolean
  }
  summary: {
    clicks: number
    submitted: number
    inProgress: number
    completed: number
  }
  referrals: ReferralRow[]
}

export default function PartnerDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/partner')
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error || 'Unable to load your partner dashboard.')
        setData(null)
        return
      }
      setData(payload)
    } catch {
      setError('Unable to load your partner dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const copyLink = async () => {
    if (!data?.profile.link) return
    try {
      await navigator.clipboard.writeText(data.profile.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg-soft">
      <header className="border-b border-brand-border bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <BrandLogo height={32} href="/partner" />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm font-semibold text-brand-muted hover:text-brand-text"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-[1100px] mx-auto px-6 py-10">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Partner dashboard</h1>
        {loading ? <p className="text-sm text-brand-muted">Loading…</p> : null}
        {error && !data ? <p className="text-sm text-brand-muted">{error}</p> : null}
        {data ? (
          <>
            <p className="text-sm text-brand-muted mb-6">
              {data.profile.companyName} · {data.profile.profession} · {data.profile.serviceArea}
            </p>
            {!data.profile.linkActive ? (
              <div className="mb-6 rounded-2xl border border-accent/40 bg-accent-soft px-5 py-4 text-sm text-brand-text">
                Sunday Harmony still needs to approve this account. Your referral link is saved and stays inactive until then.
              </div>
            ) : null}
            <div className="bg-white border border-brand-border rounded-xl p-5 mb-6">
              <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">Your referral link</div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  readOnly
                  value={data.profile.link}
                  className="flex-1 py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-sm text-brand-text"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  disabled={!data.profile.linkActive}
                  className="px-4 py-3 bg-brand-text text-white text-sm font-semibold rounded-[10px] disabled:opacity-50"
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <p className="text-xs text-brand-muted mt-2">
                Code {data.profile.code || '—'}
                {data.profile.linkActive ? '' : ' · Inactive until approved'}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Link clicks" value={data.summary.clicks} />
              <StatCard label="Applications" value={data.summary.submitted} />
              <StatCard label="In progress" value={data.summary.inProgress} />
              <StatCard label="Completed" value={data.summary.completed} color="gold" />
            </div>
            <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
              <div className="p-5 border-b border-brand-border">
                <h2 className="text-sm font-bold text-brand-text">Referred clients</h2>
                <p className="text-xs text-brand-muted mt-1">
                  Names are shortened. Current scores are the latest bureau scores on file. Contact details and documents stay with Sunday Harmony.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
                    <tr>
                      {['Submitted', 'Client', 'Current scores', 'Stage', 'Updated', 'Dispute round'].map((heading) => (
                        <th key={heading} className="text-left p-3 font-semibold">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.referrals.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-brand-dim">
                          No applications yet.{' '}
                          <Link href="/credit" className="text-accent hover:underline">See the credit page</Link>
                        </td>
                      </tr>
                    ) : (
                      data.referrals.map((row) => (
                        <tr key={row.id} className="border-t border-brand-border">
                          <td className="p-3">{new Date(row.date).toLocaleDateString()}</td>
                          <td className="p-3">{row.applicant}</td>
                          <td className="p-3"><CurrentScoresCell scores={row.currentScores} /></td>
                          <td className="p-3">{row.stage}</td>
                          <td className="p-3">{new Date(row.updatedAt).toLocaleDateString()}</td>
                          <td className="p-3">{row.disputeRound ? `Round ${row.disputeRound}` : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
