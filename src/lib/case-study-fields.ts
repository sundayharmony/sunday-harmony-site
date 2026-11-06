export const CASE_STUDY_NAME_MAX = 160
export const CASE_STUDY_BLURB_MAX = 400
export const CASE_STUDY_MIGRATION = 'supabase-migration-046-case-studies.sql'

export type CaseStudyAdmin = {
  id: string
  companyName: string
  blurb: string
  logoUrl: string | null
  published: boolean
}

export type CaseStudyFields = {
  companyName: string
  blurb: string
  published: boolean
}

function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

export function parseCaseStudyFields(
  body: Record<string, unknown>
): { ok: true; value: CaseStudyFields } | { ok: false; error: string } {
  const companyName = clean(body.companyName, CASE_STUDY_NAME_MAX)
  const blurb = clean(body.blurb, CASE_STUDY_BLURB_MAX)
  if (companyName.length < 2) return { ok: false, error: 'Company name is required.' }
  return {
    ok: true,
    value: {
      companyName,
      blurb,
      published: body.published !== false,
    },
  }
}
