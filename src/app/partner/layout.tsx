import type { Metadata } from 'next'
import PartnerShell from '@/components/partner/PartnerShell'
import { NO_INDEX } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Partner dashboard',
  robots: NO_INDEX,
}

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <PartnerShell>{children}</PartnerShell>
}
