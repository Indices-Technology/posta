/**
 * The parcel's journey for the map: its stops and how far it has got. Pure, so the privacy rules
 * are tested in one place.
 *
 * Who sees what:
 *   owner (the sender, staff)  exact pickup pin, exact delivery pin
 *   public (tracking link)     pickup city only; delivery rounded to ~1 km (neighbourhood, not the
 *                              house), because tracking links get forwarded
 *   centres are businesses and always show exactly.
 *
 * Posta has no live GPS, so "moving" never claims a position: it only says the parcel is between
 * two stops. The map animates along that stretch and says so in words.
 */
import { cityCentre } from '../../../../shared/utils/postcode'

export type Audience = 'owner' | 'public'
type Point = [number, number] // [lng, lat]

export interface JourneyInput {
  status: string
  fromCity: string
  toCity: string
  pickupLat?: number | null
  pickupLng?: number | null
  dropLat?: number | null
  dropLng?: number | null
  /** The fulfilment centre on leg 1, once matched. */
  hub?: { name: string; lat: number; lng: number } | null
}

export interface Stop {
  key: 'pickup' | 'hub' | 'drop'
  label: string
  lng: number
  lat: number
}

const pin = (lat?: number | null, lng?: number | null): Point | undefined =>
  lat != null && lng != null ? [lng, lat] : undefined
const neighbourhood = ([lng, lat]: Point): Point => [Math.round(lng * 100) / 100, Math.round(lat * 100) / 100]

export function buildJourney(p: JourneyInput, audience: Audience) {
  const exactDrop = pin(p.dropLat, p.dropLng)
  const pickup = (audience === 'owner' && pin(p.pickupLat, p.pickupLng)) || cityCentre(p.fromCity)
  const drop = exactDrop ? (audience === 'owner' ? exactDrop : neighbourhood(exactDrop)) : cityCentre(p.toCity)

  const stops: Stop[] = []
  if (pickup) stops.push({ key: 'pickup', label: p.fromCity, lng: pickup[0], lat: pickup[1] })
  if (p.hub) stops.push({ key: 'hub', label: p.hub.name, lng: p.hub.lng, lat: p.hub.lat })
  if (drop) stops.push({ key: 'drop', label: p.toCity, lng: drop[0], lat: drop[1] })
  if (stops.length < 2) return null

  // `at` = the last stop the parcel has reached; `moving` = on its way to the next one.
  const hub = Math.max(0, stops.findIndex((s) => s.key === 'hub'))
  const progress: Record<string, { at: number; moving: boolean }> = {
    NEW: { at: 0, moving: false },
    MATCHED: { at: 0, moving: false },
    IN_TRANSIT: { at: 0, moving: true },
    AT_HUB: { at: hub, moving: false },
    OUT_FOR_DELIVERY: { at: hub, moving: true },
    DELIVERED: { at: stops.length - 1, moving: false },
  }
  const { at, moving: wantsToMove } = progress[p.status] ?? { at: 0, moving: false }
  const moving = wantsToMove && at < stops.length - 1

  return {
    stops,
    at,
    moving,
    /** Words for the moving stretch: "Between Jos and Yaba Partner Shop". */
    between: moving ? `Between ${stops[at]!.label} and ${stops[at + 1]!.label}` : null,
  }
}

export type Journey = NonNullable<ReturnType<typeof buildJourney>>
