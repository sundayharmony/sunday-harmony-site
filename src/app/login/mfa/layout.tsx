'use client'

import { SessionProvider } from 'next-auth/react'

export default function LoginMfaLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
