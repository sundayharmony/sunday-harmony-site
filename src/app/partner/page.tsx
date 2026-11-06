'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import ReferralLinkQrPanel from '@/components/referrals/ReferralLinkQrPanel'
import StatCard from '@/components/ui/StatCard'
import { formatPartnerDate } from '@/lib/partner-progress'

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

function ReferralFacts({ row }: { row: ReferralRow }) {
  return (
    <>
      <div>
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">Submitted</dt>
        <dd className="mt-0.5 text-brand-text">{formatPartnerDate(row.date)}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">Current scores</dt>
        <dd className="mt-0.5"><CurrentScoresCell scores={row.currentScores} /></dd>
      </div>
      <div>
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">Stage</dt>
        <dd className="mt-0.5 text-brand-text">{row.stage}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">Updated</dt>
        <dd className="mt-0.5 text-brand-text">{formatPartnerDate(row.updatedAt)}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">Dispute round</dt>
        <dd className="mt-0.5 text-brand-text">{row.disputeRound ? `Round ${row.disputeRound}` : '—'}</dd>
      </div>
    </>
  )
}

export default function PartnerDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/partner')
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error || 'Unable to load your partner dashboard.')
        setData(null)
        return
      }
      setError('')
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

  return (
    <main className="mx-auto max-w-[1100px] min-w-0 px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Partner dashboard</h1>
        {loading ? <p className="text-sm text-brand-muted">Loading…</p> : null}
        {error && !data ? <p className="text-sm text-brand-red" role="alert">{error}</p> : null}
        {data ? (
          <>
            <p className="text-sm text-brand-muted mb-6 break-words">
              {data.profile.companyName} · {data.profile.profession} · {data.profile.serviceArea}
            </p>
            {!data.profile.linkActive ? (
              <div className="mb-6 rounded-2xl border border-accent/40 bg-accent-soft px-5 py-4 text-sm text-brand-text">
                Sunday Harmony still needs to approve this account. Your referral link is saved and stays inactive until then.
              </div>
            ) : null}
            <div className="mb-6 min-w-0">
              <ReferralLinkQrPanel
                title="Partner referral link"
                link={data.profile.link}
                code={data.profile.code}
                active={data.profile.linkActive}
                inactiveHint="Your QR code is ready, but the link stays inactive until Sunday Harmony approves your account."
                hint="People who open this link choose Build or Fund, then start that intake at the top of the page. Clicks and applications still show here."
                downloadLabelPrefix={data.profile.companyName || 'partner'}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Link clicks" value={data.summary.clicks} />
              <StatCard label="Applications" value={data.summary.submitted} />
              <StatCard label="In progress" value={data.summary.inProgress} />
              <StatCard label="Completed" value={data.summary.completed} color="gold" />
            </div>
            <div className="bg-white border border-brand-border rounded-xl overflow-hidden min-w-0">
              <div className="p-5 border-b border-brand-border">
                <h2 className="text-sm font-bold text-brand-text">Referred clients</h2>
                <p className="text-xs text-brand-muted mt-1">
                  Names are shortened. Current scores are the latest bureau scores on file. Contact details and documents stay with Sunday Harmony.
                </p>
              </div>
              {data.referrals.length === 0 ? (
                <p className="p-6 text-center text-brand-dim">
                  No applications yet.{' '}
                  <Link href="/build-fund" className="text-accent hover:underline">See the Fund page</Link>
                </p>
              ) : (
                <>
                  <ul className="sm:hidden divide-y divide-brand-border">
                    {data.referrals.map((row) => (
                      <li key={row.id} className="p-4">
                        <p className="font-semibold text-brand-text break-words">{row.applicant}</p>
                        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm">
                          <ReferralFacts row={row} />
                        </dl>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50 text-xs uppercase text-brand-dim">
                        <tr>
                          {['Submitted', 'Client', 'Current scores', 'Stage', 'Updated', 'Dispute round'].map((heading) => (
                            <th key={heading} className="text-left p-3 font-semibold">{heading}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.referrals.map((row) => (
                          <tr key={row.id} className="border-t border-brand-border">
                            <td className="p-3 whitespace-nowrap">{formatPartnerDate(row.date)}</td>
                            <td className="p-3">{row.applicant}</td>
                            <td className="p-3"><CurrentScoresCell scores={row.currentScores} /></td>
                            <td className="p-3">{row.stage}</td>
                            <td className="p-3 whitespace-nowrap">{formatPartnerDate(row.updatedAt)}</td>
                            <td className="p-3">{row.disputeRound ? `Round ${row.disputeRound}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        ) : null}
    </main>
  )
}
