/**
 * Turn what a person gave us into a national postcode. NIPOST has no "typed address → postcode",
 * only "map point → postcode", so everything becomes a map point first:
 *
 *   postcode       → checked with NIPOST
 *   GPS lat/lng    → as given
 *   map link       → the point in the link (short links expanded once)
 *   typed address  → OpenStreetMap search
 *   then           → the building nearest that point (NIPOST, within 250 m)
 *
 * Stores nothing: Posta keeps only confirmed shipments.
 */
import type { ResolveInput } from '../schemas/address.schema'
import { pointIn, SHORT_LINK_HOSTS, statusOf, type LatLng, type ResolveStatus, type Source } from '../utils/mapPoint'
import { placeService } from '~~/layers/core/server/services/place.service'
import { postcodeService } from '~~/layers/core/server/services/postcode.service'

async function pointFromLink(link: string): Promise<LatLng | null> {
  const direct = pointIn(link)
  if (direct) return direct
  if (!SHORT_LINK_HOSTS.has(new URL(link).hostname)) return null
  // One hop, no follow: the Location header holds the long link with the point in it.
  const res = await $fetch
    .raw(link, { method: 'HEAD', redirect: 'manual', ignoreResponseError: true, timeout: 4000 })
    .catch(() => null)
  const to = res?.headers.get('location')
  return to ? pointIn(to) : null
}

export const addressService = {
  async resolve(input: ResolveInput) {
    if (input.postcode) {
      const code = normalizePostcode(input.postcode)
      if (code) {
        // null = no live key or NIPOST down: the shape is right, so let the person confirm it.
        const exists = await postcodeExists(code)
        if (exists !== false) {
          return { status: (exists ? 'found' : 'check') as ResolveStatus, source: 'postcode' as Source, postcode: code, lat: null, lng: null, distanceM: null, place: null }
        }
      }
      // A wrong or unknown postcode falls through to whatever else was sent.
    }

    let point: LatLng | null = null
    let source: Source = 'gps'
    let exactText = false
    if (input.lat != null && input.lng != null) point = { lat: input.lat, lng: input.lng }
    if (!point && input.mapLink) {
      point = await pointFromLink(input.mapLink)
      source = 'link'
    }
    if (!point && input.address) {
      const q = [input.address, input.city, input.state].filter(Boolean).join(', ')
      const [top] = (await placeService.search({ q })).filter((r) => r.kind === 'place')
      if (top?.lat != null && top.lng != null) {
        point = { lat: top.lat, lng: top.lng }
        exactText = !!top.exact
      }
      source = 'text'
    }

    const none = { status: 'none' as ResolveStatus, source, postcode: null, lat: point?.lat ?? null, lng: point?.lng ?? null, distanceM: null, place: null }
    if (!point) return none

    const hit = await postcodeService.fromPoint(point).catch((err) => {
      logger.warn('[address] postcode lookup failed', { error: (err as Error).message })
      return null
    })
    if (!hit?.found || !hit.postcode) return none

    return {
      status: statusOf(source, hit.confidence, exactText),
      source,
      postcode: hit.postcode,
      lat: point.lat,
      lng: point.lng,
      distanceM: hit.distanceM ?? null,
      place: hit.place ?? null,
    }
  },
}
