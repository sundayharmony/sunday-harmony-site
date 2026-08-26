import type { Metadata } from 'next'
import { NO_INDEX } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Forgot password',
  robots: NO_INDEX,
  alternates: { canonical: '/forgot-password' },
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
