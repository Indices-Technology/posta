/**
 * The search box on the map. Two sources, chosen by what was typed:
 *   - something shaped like a postcode ("LA 02", "FC-01-A01") → NIPOST's segment-aware autocomplete
 *     (codes only, no map position)
 *   - anything else ("Yaba market") → Photon, a free OpenStreetMap search built for search-as-you-type
 *     (a map position; the postcode then comes from NIPOST's reverse lookup at that point)
 * Photon's own `postcode` field is the old 6-digit system, so it is ignored.
 */

const NIGERIA_BBOX = '2.69,4.24,14.68,13.87'
const looksLikePostcode = (q: string) => /^[A-Za-z]{2}[\s-]?\d/.test(q.trim())

export interface PlaceResult {
  kind: 'place' | 'postcode'
  label: string
  detail: string | null
  /** Places only: where to move the map. */
  lat?: number
  lng?: number
  /** Postcodes only: the (partial) code, and whether it is a full building postcode. */
  code?: string
  complete?: boolean
}

// ponytail: per-process memory cache for a day; searches repeat a lot (same markets, same streets).
const cache = new Map<string, { value: PlaceResult[]; until: number }>()

async function postcodes(q: string): Promise<PlaceResult[]> {
  const key = useRuntimeConfig().postcodeApiKey
  if (!key) return []
  const res = await $fetch<{ data: { segment: string; suggestions: { code: string; label: string }[] } }>(
    'https://api.postcode.gov.ng/v1/search/autocomplete',
    { query: { q }, headers: { 'X-API-Key': key }, timeout: 5000 },
  ).catch((err) => {
    logger.warn('[places] postcode autocomplete failed', { error: (err as Error).message })
    return null
  })
  if (!res) return []
  return res.data.suggestions.slice(0, 8).map((s) => {
    const code = normalizePostcode(s.code) ?? s.code
    return { kind: 'postcode' as const, label: code, detail: s.label && s.label !== s.code ? s.label : null, code, complete: res.data.segment === 'unit' }
  })
}

async function places(q: string, near?: { lat: number; lng: number }): Promise<PlaceResult[]> {
  const res = await $fetch<{ features: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[] }>(
    'https://photon.komoot.io/api/',
    {
      query: { q, limit: 6, lang: 'en', bbox: NIGERIA_BBOX, ...(near ? { lat: near.lat, lon: near.lng } : {}) },
      headers: { 'user-agent': 'Posta/1 (posta.indicestech.com)' },
      timeout: 5000,
    },
  ).catch((err) => {
    logger.warn('[places] photon search failed', { error: (err as Error).message })
    return null
  })
  if (!res) return []
  return res.features
    .filter((f) => f.properties.countrycode === 'NG')
    .map((f) => {
      const p = f.properties
      const where = [p.street, p.district, p.city ?? p.county, p.state].filter((x, i, a) => x && x !== p.name && a.indexOf(x) === i)
      return { kind: 'place' as const, label: p.name ?? p.street ?? q, detail: where.join(', ') || null, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }
    })
}

export const placeService = {
  async search({ q, lat, lng }: { q: string; lat?: number; lng?: number }) {
    const k = `${q.toLowerCase()}|${lat?.toFixed(1)}|${lng?.toFixed(1)}`
    const hit = cache.get(k)
    if (hit && hit.until > Date.now()) return hit.value

    const value = looksLikePostcode(q) ? await postcodes(q) : await places(q, lat != null && lng != null ? { lat, lng } : undefined)
    if (cache.size > 5000) cache.clear()
    cache.set(k, { value, until: Date.now() + 24 * 3_600_000 })
    return value
  },
}

