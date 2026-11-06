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
        title="Your intake link"
        link={share.link}
        code={share.code}
        active={share.linkActive}
        inactiveHint="Your QR code is ready, but the link stays inactive until Sunday Harmony approves your account."
        downloadLabelPrefix={share.companyName}
      />
    )
  }

  return (
    <p className="rounded-2xl border border-brand-border bg-white px-5 py-4 text-base leading-relaxed text-brand-muted">
      {error ? TOOLKIT_NEXT_STEP.loadError : 'Loading your intake link…'}
    </p>
  )
}
