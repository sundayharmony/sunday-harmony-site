import { redirect } from 'next/navigation'

export default async function AdminPartnersRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  if (tab === 'client-referrers') redirect('/admin/referrals')
  redirect('/admin/referrals?tab=partners')
}
