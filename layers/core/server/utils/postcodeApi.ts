import { AppError } from '../types/errors'

/**
 * The national postcode API (api.postcode.gov.ng). Lookup level 1 (is it real?) is free.
 *
 * Only a LIVE key checks real postcodes: test keys resolve 5 sandbox buildings in the FCT and
 * nothing else, so with a test key every Jos or Lagos postcode would look invalid. Without a
 * live key Posta checks the shape only.
 */
export async function postcodeExists(canonical: string): Promise<boolean | null> {
  const key = useRuntimeConfig().postcodeApiKey
  if (!key.startsWith('nipost_live_')) return null

  try {
    const res = await $fetch<{ data: { valid: boolean } }>('https://api.postcode.gov.ng/v1/lookup', {
      query: { code: canonical, level: 1 },
      headers: { 'X-API-Key': key },
      timeout: 4000,
    })
    return res.data.valid
  } catch (err) {
    // The registry being down or rate-limiting must not stop a parcel being booked.
    logger.warn('[postcode] lookup failed', { error: (err as Error).message })
    return null
  }
}

/** What NIPOST's reverse geocode returns (GET /v1/search/reverse). Admin names need lookup level 2+. */
interface NipostReverse {
  data: {
    found: boolean
    radius_m: number
    message?: string
    unit?: {
      postcode: string
      display: string
      distance_m: number
      confidence: 'high' | 'medium' | 'low'
      state_name?: string
      lga_name?: string
      locality_name?: string
      address?: string
    }
  }
}

/**
 * The postcode of the building nearest a map point (within maxDistanceM, NIPOST caps it at 250 m),
 * or null when nothing is that close. Any key works here; test keys only know the FCT sandbox.
 */
export async function reverseGeocode(lat: number, lng: number, maxDistanceM = 250) {
  const key = useRuntimeConfig().postcodeApiKey
  if (!key) throw new AppError('POSTCODE_NOT_SET_UP', 'Postcode lookup is not set up yet. Type the postcode instead.', 503)

  const res = await $fetch
    .raw<NipostReverse>('https://api.postcode.gov.ng/v1/search/reverse', {
      query: { lat, lng, max_distance_m: maxDistanceM },
      headers: { 'X-API-Key': key },
      timeout: 6000,
      ignoreResponseError: true,
    })
    .catch((err) => {
      logger.warn('[postcode] reverse geocode unreachable', { error: (err as Error).message })
      throw new AppError('POSTCODE_UNAVAILABLE', 'The postcode service is not answering. Type the postcode instead.', 502)
    })

  if (res.status === 429) throw new AppError('POSTCODE_BUSY', 'Too many lookups. Wait a moment and tap again.', 429)
  if (!res.ok) {
    // 401/403 here means our key is wrong or lacks the scope: our problem, not the person's.
    logger.error('[postcode] reverse geocode refused', { status: res.status })
    throw new AppError('POSTCODE_UNAVAILABLE', 'The postcode service is not answering. Type the postcode instead.', 502)
  }

  const unit = res._data?.data.unit
  if (!res._data?.data.found || !unit) return null
  return {
    postcode: normalizePostcode(unit.postcode) ?? unit.postcode,
    distanceM: Math.round(unit.distance_m),
    confidence: unit.confidence,
    address: unit.address ?? null,
    place: [unit.locality_name, unit.lga_name, unit.state_name].filter(Boolean).join(', ') || null,
  }
}

/** Reject postcodes the registry says don't exist. Unknown (no key, API down) passes. */
export async function assertPostcodesExist(fields: Record<string, string>) {
  for (const [field, code] of Object.entries(fields)) {
    if ((await postcodeExists(code)) === false) {
      throw new AppError('UNKNOWN_POSTCODE', `${code} is not a registered postcode`, 400, field)
    }
  }
}
