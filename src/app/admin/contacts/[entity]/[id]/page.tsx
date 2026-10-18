import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findCanonicalPersonId } from '@/lib/people-db'

export const dynamic = 'force-dynamic'

/** Old CRM contact URLs resolve to the one person file. */
export default async function LegacyContactRedirect({
  params,
}: {
  params: Promise<{ entity: string; id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const scope = session?.user?.role === 'credit_manager' ? 'credit' : 'all'
  const personId = await findCanonicalPersonId(id, scope)
  if (!personId) notFound()
  redirect(`/admin/people/${personId}`)
}
