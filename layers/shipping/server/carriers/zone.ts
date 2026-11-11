/**
 * Nigeria domestic zoning.
 *
 * GIG zones are proximity-relative to the pickup station; we approximate with a
 * deterministic origin-state → destination-state → zone resolver over the 6
 * geopolitical zones + intra-state. See docs/SHIPPING.md §7.
 *
 * This is the in-code reference implementation. The production matrix lives in
 * the `ShippingZone` DB table (effective-dated, admin-editable) and overrides
 * this; this resolver remains the seed + fallback.
 */

export type ZoneCode = 'Z1' | 'Z2' | 'Z3' | 'Z4'

const GEO_ZONES: Record<string, string[]> = {
  NORTH_CENTRAL: ['benue', 'kogi', 'kwara', 'nasarawa', 'niger', 'plateau', 'fct', 'abuja', 'federal capital territory'],
  NORTH_EAST: ['adamawa', 'bauchi', 'borno', 'gombe', 'taraba', 'yobe'],
  NORTH_WEST: ['jigawa', 'kaduna', 'kano', 'katsina', 'kebbi', 'sokoto', 'zamfara'],
  SOUTH_EAST: ['abia', 'anambra', 'ebonyi', 'enugu', 'imo'],
  SOUTH_SOUTH: ['akwa ibom', 'bayelsa', 'cross river', 'delta', 'edo', 'rivers'],
  SOUTH_WEST: ['ekiti', 'lagos', 'ogun', 'ondo', 'osun', 'oyo'],
}

/** States hosting a major GIG processing hub — qualify a cross-zone trip for Z3. */
const HUB_STATES = new Set([
  'lagos', 'fct', 'abuja', 'rivers', 'kano', 'plateau', 'edo', 'kwara', 'sokoto',
])

/** GoFaster Express cities (GIG Annexure 1). */
const EXPRESS_CITIES = new Set([
  'lagos', 'abuja', 'port harcourt', 'phc', 'kano', 'jos', 'benin', 'benin city', 'ilorin', 'sokoto',
])

export const ZONE_ETA: Record<ZoneCode, { text: string; minHours: number; maxHours: number }> = {
  Z1: { text: '24 hours', minHours: 24, maxHours: 24 },
  Z2: { text: '48 hours', minHours: 24, maxHours: 48 },
  Z3: { text: '3–4 working days', minHours: 72, maxHours: 96 },
  Z4: { text: '3–5 working days', minHours: 72, maxHours: 120 },
}

function norm(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+state$/, '').replace(/\s+/g, ' ')
}

function geoZoneOf(state: string): string | null {
  const n = norm(state)
  for (const [zone, members] of Object.entries(GEO_ZONES)) {
    if (members.includes(n)) return zone
  }
  return null
}

/**
 * Resolve the GIG zone for an origin→destination state pair.
 *   same state            → Z1
 *   same geopolitical zone → Z2
 *   cross-zone, both hubs  → Z3
 *   cross-zone otherwise   → Z4
 */
export function resolveZone(originState: string, destState: string): ZoneCode {
  const o = norm(originState)
  const d = norm(destState)
  if (o && o === d) return 'Z1'

  const oz = geoZoneOf(o)
  const dz = geoZoneOf(d)
  if (oz && dz && oz === dz) return 'Z2'

  if (HUB_STATES.has(o) && HUB_STATES.has(d)) return 'Z3'
  return 'Z4'
}

/** Express is available only when both endpoints are GoFaster cities. */
export function isExpressEligible(originCity: string, destCity: string): boolean {
  return EXPRESS_CITIES.has(norm(originCity)) && EXPRESS_CITIES.has(norm(destCity))
}
