import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

interface GooglePlacesSearchResult {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  businessStatus?: string
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (session instanceof NextResponse) return session

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Missing GOOGLE_PLACES_API_KEY. Add it in Vercel Environment Variables (Production) or .env.local, enable Places API (New) on the key, then redeploy.',
        },
        { status: 503 }
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const b = body as Record<string, unknown>
    const service = asText(b?.service).trim()
    const city = asText(b?.city).trim()
    const maxResultsRaw = Number(b?.maxResults)
    const maxResults = Number.isFinite(maxResultsRaw) ? Math.min(Math.max(maxResultsRaw, 1), 20) : 10

    if (!service || !city) {
      return NextResponse.json({ error: 'service and city are required' }, { status: 400 })
    }

    const textQuery = `${service} in ${city}`
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus',
      },
      body: JSON.stringify({
        textQuery,
        pageSize: maxResults,
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('Google Places API error:', response.status, errorText)
      const snippet = errorText.slice(0, 280)
      return NextResponse.json(
        {
          error: 'Failed to fetch businesses from Google Places',
          ...(snippet ? { detail: snippet } : {}),
        },
        { status: 502 }
      )
    }

    const payload = await response.json()
    const places = Array.isArray(payload?.places) ? (payload.places as GooglePlacesSearchResult[]) : []

    const normalized = places
      .map(place => ({
        google_place_id: place.id || '',
        business: place.displayName?.text || '',
        location_text: place.formattedAddress || '',
        phone: place.internationalPhoneNumber || '',
        website: place.websiteUri || '',
        rating: typeof place.rating === 'number' ? place.rating : null,
        review_count: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
        business_status: place.businessStatus || '',
        source: 'outbound' as const,
      }))
      .filter(candidate => candidate.business)

    return NextResponse.json({ query: textQuery, results: normalized })
  } catch (err) {
    console.error('POST /api/admin/leads/discover error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
