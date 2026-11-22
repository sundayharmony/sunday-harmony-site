import { Suspense } from 'react'
import MarketingDesk from '@/components/admin/MarketingDesk'

export const dynamic = 'force-dynamic'

export default function MarketingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-brand-muted">Loading marketing…</p>}>
      <MarketingDesk />
    </Suspense>
  )
}
