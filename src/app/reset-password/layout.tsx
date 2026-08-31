import type { Metadata } from 'next'
import { NO_INDEX } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Reset password',
  robots: NO_INDEX,
  alternates: { canonical: '/reset-password' },
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
