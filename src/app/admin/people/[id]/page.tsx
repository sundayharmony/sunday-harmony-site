import PersonFileView from '@/components/admin/PersonFile'

export const dynamic = 'force-dynamic'

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PersonFileView id={id} />
}
