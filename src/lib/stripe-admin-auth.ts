import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function requireAdminSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || role !== 'admin') return null
  return session
}
