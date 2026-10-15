import type { Metadata } from 'next'
import { NO_INDEX } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Partner signup',
  robots: NO_INDEX,
}

export default function PartnerSignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
