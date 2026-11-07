'use client'

import { useEffect, useState } from 'react'
import ReferralLinkQrPanel from '@/components/referrals/ReferralLinkQrPanel'
import { TOOLKIT_NEXT_STEP } from '@/lib/partner-toolkit'

type ReferralShare = {
  link: string
  code: string
  linkActive: boolean
  companyName: string
}

export default function PartnerToolkitNextStep() {
  const [share, setShare] = useState<ReferralShare | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/partner')
        const payload = await res.json().catch(() => ({}))
        if (!res.ok || !payload?.profile?.link) {
          if (!cancelled) setError(true)
          return
        }
        if (!cancelled) {
          setShare({
            link: payload.profile.link,
            code: payload.profile.code || '',
            linkActive: Boolean(payload.profile.linkActive),
            companyName: payload.profile.companyName || 'partner',
          })
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (share) {
    return (
      <ReferralLinkQrPanel
        title="Your referral link"
        link={share.link}
        code={share.code}
        active={share.linkActive}
        inactiveHint="Copy, QR, and scans stay off until Sunday Harmony approves this account."
        hint="People who open this link choose Build or Fund, then start that intake at the top of the page."
        downloadLabelPrefix={share.companyName}
      />
    )
  }

  return (
    <p className="rounded-2xl border border-brand-border bg-white px-5 py-4 text-base leading-relaxed text-brand-muted">
      {error ? TOOLKIT_NEXT_STEP.loadError : 'Loading your referral link…'}
    </p>
  )
}
