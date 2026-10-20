import type { ReverseQuery } from '../schemas/postcode.schema'

type Found = Awaited<ReturnType<typeof reverseGeocode>>

// ponytail: per-process memory cache; buildings don't move, so a day is safe. Move to the
// database if NIPOST lookups start costing credits or Posta runs many instances.
const cache = new Map<string, { value: Found; until: number }>()
const DAY = 24 * 60 * 60 * 1000

export const postcodeService = {
  /**
   * The national postcode nearest a map point. Points ~1 m apart share a cache entry
   * (5 decimal places), so dragging a pin back and forth doesn't call NIPOST each time.
   */
  async fromPoint({ lat, lng }: ReverseQuery) {
    const k = `${lat.toFixed(5)},${lng.toFixed(5)}`
    const hit = cache.get(k)
    if (hit && hit.until > Date.now()) return { found: !!hit.value, ...hit.value }

    const value = await reverseGeocode(lat, lng)
    if (cache.size > 20_000) cache.clear()
    cache.set(k, { value, until: Date.now() + DAY })
    return { found: !!value, ...value }
  },
}
