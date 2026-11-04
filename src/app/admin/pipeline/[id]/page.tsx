import ProspectFile from '@/components/admin/ProspectFile'

export const dynamic = 'force-dynamic'

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ProspectFile id={id} />
}
