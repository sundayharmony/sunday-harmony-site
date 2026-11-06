import { randomUUID } from 'crypto'
import {
  CASE_STUDY_MIGRATION,
  type CaseStudyAdmin,
  type CaseStudyFields,
} from '@/lib/case-study-fields'
import {
  PARTNER_LOGOS_BUCKET,
  partnerLogoPublicUrl,
  validatePartnerLogo,
  type PartnerLogo,
} from '@/lib/partner-logos'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export {
  CASE_STUDY_BLURB_MAX,
  CASE_STUDY_MIGRATION,
  CASE_STUDY_NAME_MAX,
  parseCaseStudyFields,
  type CaseStudyAdmin,
  type CaseStudyFields,
} from '@/lib/case-study-fields'

export type CaseStudyRow = {
  id: string
  company_name: string
  blurb: string
  logo_path: string | null
  published: boolean
  created_at: string
  updated_at: string
}

function missingTable(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /case_studies|schema cache/i.test(error?.message || '')
  )
}

function migrationHint() {
  return `Run ${CASE_STUDY_MIGRATION} in the Supabase SQL Editor, then try again.`
}

export function toAdminCaseStudy(row: CaseStudyRow): CaseStudyAdmin {
  return {
    id: row.id,
    companyName: row.company_name,
    blurb: row.blurb || '',
    logoUrl: partnerLogoPublicUrl(row.logo_path),
    published: row.published,
  }
}

function toPublicCard(row: CaseStudyRow): PartnerLogo | null {
  const src = partnerLogoPublicUrl(row.logo_path)
  const blurb = (row.blurb || '').trim()
  if (!src && !blurb) return null
  return { companyName: row.company_name, src, blurb }
}

export async function listCaseStudiesForAdmin(): Promise<
  { ok: true; caseStudies: CaseStudyAdmin[] } | { ok: false; error: string; status: number }
> {
  if (!isSupabaseConfigured()) return { ok: true, caseStudies: [] }
  const { data, error } = await getSupabase()
    .from('case_studies')
    .select('id, company_name, blurb, logo_path, published, created_at, updated_at')
    .order('company_name', { ascending: true })
  if (error) {
    if (missingTable(error)) return { ok: false, error: migrationHint(), status: 503 }
    console.error('listCaseStudiesForAdmin:', error)
    return { ok: false, error: 'Failed to load case studies.', status: 500 }
  }
  return { ok: true, caseStudies: ((data || []) as CaseStudyRow[]).map(toAdminCaseStudy) }
}

export async function listPublicCaseStudies(): Promise<PartnerLogo[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await getSupabase()
    .from('case_studies')
    .select('id, company_name, blurb, logo_path, published, created_at, updated_at')
    .eq('published', true)
    .order('company_name', { ascending: true })
  if (error) {
    if (missingTable(error)) return []
    console.error('listPublicCaseStudies:', error)
    return []
  }
  return ((data || []) as CaseStudyRow[]).flatMap((row) => {
    const card = toPublicCard(row)
    return card ? [card] : []
  })
}

export async function createCaseStudy(
  fields: CaseStudyFields
): Promise<{ ok: true; caseStudy: CaseStudyAdmin } | { ok: false; error: string; status: number }> {
  if (!isSupabaseConfigured()) return { ok: false, error: migrationHint(), status: 503 }
  const now = new Date().toISOString()
  const { data, error } = await getSupabase()
    .from('case_studies')
    .insert({
      company_name: fields.companyName,
      blurb: fields.blurb,
      published: fields.published,
      created_at: now,
      updated_at: now,
    })
    .select('id, company_name, blurb, logo_path, published, created_at, updated_at')
    .single()
  if (error) {
    if (missingTable(error)) return { ok: false, error: migrationHint(), status: 503 }
    console.error('createCaseStudy:', error)
    return { ok: false, error: 'The case study could not be saved.', status: 500 }
  }
  return { ok: true, caseStudy: toAdminCaseStudy(data as CaseStudyRow) }
}

export async function updateCaseStudy(
  id: string,
  fields: CaseStudyFields
): Promise<{ ok: true; caseStudy: CaseStudyAdmin } | { ok: false; error: string; status: number }> {
  if (!id) return { ok: false, error: 'Case study is required.', status: 400 }
  const { data, error } = await getSupabase()
    .from('case_studies')
    .update({
      company_name: fields.companyName,
      blurb: fields.blurb,
      published: fields.published,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, company_name, blurb, logo_path, published, created_at, updated_at')
    .single()
  if (error) {
    if (missingTable(error)) return { ok: false, error: migrationHint(), status: 503 }
    if (error.code === 'PGRST116') return { ok: false, error: 'Case study not found.', status: 404 }
    console.error('updateCaseStudy:', error)
    return { ok: false, error: 'The case study could not be saved.', status: 500 }
  }
  return { ok: true, caseStudy: toAdminCaseStudy(data as CaseStudyRow) }
}

async function getCaseStudyRow(id: string): Promise<CaseStudyRow | null> {
  const { data, error } = await getSupabase()
    .from('case_studies')
    .select('id, company_name, blurb, logo_path, published, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (missingTable(error)) return null
    console.error('getCaseStudyRow:', error)
    return null
  }
  return (data as CaseStudyRow) || null
}

export async function deleteCaseStudy(
  id: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await getCaseStudyRow(id)
  if (!row) return { ok: false, error: 'Case study not found.', status: 404 }
  const { error } = await getSupabase().from('case_studies').delete().eq('id', id)
  if (error) {
    if (missingTable(error)) return { ok: false, error: migrationHint(), status: 503 }
    console.error('deleteCaseStudy:', error)
    return { ok: false, error: 'The case study could not be removed.', status: 500 }
  }
  if (row.logo_path) {
    await getSupabase().storage.from(PARTNER_LOGOS_BUCKET).remove([row.logo_path])
  }
  return { ok: true }
}

export async function saveCaseStudyLogo(
  id: string,
  buffer: Buffer
): Promise<{ ok: true; logoUrl: string } | { ok: false; error: string; status: number }> {
  const row = await getCaseStudyRow(id)
  if (!row) return { ok: false, error: 'Case study not found.', status: 404 }
  const checked = validatePartnerLogo(buffer)
  if (!checked.ok) return { ok: false, error: checked.error, status: 400 }

  const objectPath = `case-studies/${row.id}/${randomUUID()}.${checked.logo.ext}`
  const { error: uploadError } = await getSupabase().storage.from(PARTNER_LOGOS_BUCKET).upload(objectPath, buffer, {
    contentType: checked.logo.mime,
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) {
    console.error('saveCaseStudyLogo upload:', uploadError)
    return {
      ok: false,
      error: 'The logo could not be saved. Run the partner logos migration in Supabase, then try again.',
      status: 503,
    }
  }

  const { error } = await getSupabase()
    .from('case_studies')
    .update({ logo_path: objectPath, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    await getSupabase().storage.from(PARTNER_LOGOS_BUCKET).remove([objectPath])
    if (missingTable(error)) return { ok: false, error: migrationHint(), status: 503 }
    console.error('saveCaseStudyLogo:', error)
    return { ok: false, error: 'The logo could not be saved.', status: 500 }
  }

  if (row.logo_path && row.logo_path !== objectPath) {
    await getSupabase().storage.from(PARTNER_LOGOS_BUCKET).remove([row.logo_path])
  }
  const logoUrl = partnerLogoPublicUrl(objectPath)
  if (!logoUrl) return { ok: false, error: 'The logo could not be saved.', status: 500 }
  return { ok: true, logoUrl }
}

export async function clearCaseStudyLogo(
  id: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await getCaseStudyRow(id)
  if (!row) return { ok: false, error: 'Case study not found.', status: 404 }
  const { error } = await getSupabase()
    .from('case_studies')
    .update({ logo_path: null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    if (missingTable(error)) return { ok: false, error: migrationHint(), status: 503 }
    console.error('clearCaseStudyLogo:', error)
    return { ok: false, error: 'The logo could not be removed.', status: 500 }
  }
  if (row.logo_path) {
    await getSupabase().storage.from(PARTNER_LOGOS_BUCKET).remove([row.logo_path])
  }
  return { ok: true }
}
