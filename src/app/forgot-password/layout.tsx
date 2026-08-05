import type { Metadata } from 'next'
import { NO_INDEX } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Forgot password',
  robots: NO_INDEX,
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
