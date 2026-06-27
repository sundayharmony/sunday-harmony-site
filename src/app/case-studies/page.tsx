import type { Metadata } from 'next'
import PublicPageLayout from '@/components/layout/PublicPageLayout'
import CaseStudiesViewer from '@/components/case-studies/CaseStudiesViewer'
import { getPublishedCaseStudies } from '@/lib/db'

export const metadata: Metadata = {
  title: 'Case Studies | Sunday Harmony',
  description:
    'See real client results from Sunday Harmony — marketing case studies showcasing growth, strategy, and measurable outcomes.',
}

export const revalidate = 60

export default async function CaseStudiesPage() {
  const studies = await getPublishedCaseStudies()
  const initialStudies = studies.map((s) => ({
    id: s.id,
    title: s.title,
    pdf_url: s.file_url,
    updated_at: s.updated_at,
  }))

  return (
    <PublicPageLayout
      label="Results"
      title={
        <>
          Client <span className="gold-text">Case Studies</span>
        </>
      }
      description="Explore one-page snapshots of how we help businesses grow — real strategies, real outcomes, and the work behind the results."
    >
      <CaseStudiesViewer initialStudies={initialStudies} />
    </PublicPageLayout>
  )
}
