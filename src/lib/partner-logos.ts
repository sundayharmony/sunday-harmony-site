import { randomUUID } from 'crypto'
import { getPartnerProfileById, listActivePartnerLogoRows, updatePartnerLogoPath } from '@/lib/partner-db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export const PARTNER_LOGOS_BUCKET = 'partner-logos'
export const PARTNER_LOGO_MAX_BYTES = 2 * 1024 * 1024

export type PartnerLogo = {
  companyName: string
  src: string
}

type DetectedLogo = {
  mime: 'image/png' | 'image/jpeg' | 'image/webp'
  ext: 'png' | 'jpg' | 'webp'
}

export function detectPartnerLogo(buffer: Buffer): DetectedLogo | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' }
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString() === 'RIFF' &&
    buffer.subarray(8, 12).toString() === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' }
  }
  return null
}

export function validatePartnerLogo(buffer: Buffer): { ok: true; logo: DetectedLogo } | { ok: false; error: string } {
  if (buffer.length <= 0) return { ok: false, error: 'Choose a logo file.' }
  if (buffer.length > PARTNER_LOGO_MAX_BYTES) return { ok: false, error: 'Logo must be 2 MB or smaller.' }
  const logo = detectPartnerLogo(buffer)
  if (!logo) return { ok: false, error: 'Use a PNG, JPG, or WebP logo.' }
  return { ok: true, logo }
}

export function partnerLogoPublicUrl(
  objectPath: string | null | undefined,
  baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
): string | null {
  const path = (objectPath || '').replace(/^\/+/, '')
  if (!path || path.includes('..') || path.includes('\\')) return null
  const base = baseUrl.replace(/\/$/, '')
  if (!base) return null
  const encoded = path.split('/').map(segment => encodeURIComponent(segment)).join('/')
  return `${base}/storage/v1/object/public/${PARTNER_LOGOS_BUCKET}/${encoded}`
}

export async function listPublicPartnerLogos(): Promise<PartnerLogo[]> {
  if (!isSupabaseConfigured()) return []
  const rows = await listActivePartnerLogoRows()
  const logos: PartnerLogo[] = []
  for (const row of rows) {
    const src = partnerLogoPublicUrl(row.logo_path)
    if (!src) continue
    logos.push({ companyName: row.company_name, src })
  }
  return logos
}

export async function savePartnerLogo(
  partnerId: string,
  buffer: Buffer
): Promise<{ ok: true; logoUrl: string } | { ok: false; error: string; status: number }> {
  const profile = await getPartnerProfileById(partnerId)
  if (!profile) return { ok: false, error: 'Partner not found.', status: 404 }
  const checked = validatePartnerLogo(buffer)
  if (!checked.ok) return { ok: false, error: checked.error, status: 400 }

  const objectPath = `${profile.id}/${randomUUID()}.${checked.logo.ext}`
  const { error: uploadError } = await getSupabase().storage.from(PARTNER_LOGOS_BUCKET).upload(objectPath, buffer, {
    contentType: checked.logo.mime,
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) {
    console.error('savePartnerLogo upload:', uploadError)
    return {
      ok: false,
      error: 'The logo could not be saved. Run the partner logos migration in Supabase, then try again.',
      status: 503,
    }
  }

  const saved = await updatePartnerLogoPath(profile.id, objectPath)
  if (!saved.ok) {
    await getSupabase().storage.from(PARTNER_LOGOS_BUCKET).remove([objectPath])
    return {
      ok: false,
      error: saved.missingColumn
        ? 'Run the partner logos migration in Supabase, then try again.'
        : 'The logo could not be saved.',
      status: saved.missingColumn ? 503 : 500,
    }
  }

  if (profile.logo_path && profile.logo_path !== objectPath) {
    await getSupabase().storage.from(PARTNER_LOGOS_BUCKET).remove([profile.logo_path])
  }
  const logoUrl = partnerLogoPublicUrl(objectPath)
  if (!logoUrl) return { ok: false, error: 'The logo could not be saved.', status: 500 }
  return { ok: true, logoUrl }
}

export async function clearPartnerLogo(
  partnerId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const profile = await getPartnerProfileById(partnerId)
  if (!profile) return { ok: false, error: 'Partner not found.', status: 404 }
  const saved = await updatePartnerLogoPath(profile.id, null)
  if (!saved.ok) {
    return {
      ok: false,
      error: saved.missingColumn
        ? 'Run the partner logos migration in Supabase, then try again.'
        : 'The logo could not be removed.',
      status: saved.missingColumn ? 503 : 500,
    }
  }
  if (profile.logo_path) {
    await getSupabase().storage.from(PARTNER_LOGOS_BUCKET).remove([profile.logo_path])
  }
  return { ok: true }
}
