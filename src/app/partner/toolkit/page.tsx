import type { Metadata } from 'next'
import PartnerToolkit from '@/components/partner/PartnerToolkit'
import { NO_INDEX } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Partner toolkit',
  robots: NO_INDEX,
}

export default function PartnerToolkitPage() {
  return <PartnerToolkit />
}
