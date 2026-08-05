import type { Metadata } from 'next'
import { NO_INDEX } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: NO_INDEX,
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
