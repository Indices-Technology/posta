/**
 * Which trip carries which parcel, as a pure function. match.service.ts does the writes.
 *
 * A parcel fits a trip when both go between the same two cities, the trip hasn't left yet,
 * and the trip still has room. Oldest parcel first; each takes the earliest trip with room,
 * so parcels leave as soon as they can.
 *
 * ponytail: city-pair only. Jos → Abuja → Lagos style partial routes come when real trips need them.
 */

export interface ParcelToMatch {
  id: string
  fromCity: string
  toCity: string
  createdAt: Date
}

export interface TripToMatch {
  id: string
  fromCity: string
  toCity: string
  departAt: Date
  capacity: number
  /** Parcels already riding on this trip. */
  carrying: number
}

export interface Point {
  id: string
  city: string
  lat: number
  lng: number
}

const sameCity = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function matchParcels(
  parcels: ParcelToMatch[],
  trips: TripToMatch[],
  now: Date,
): { parcelId: string; tripId: string }[] {
  const room = new Map(trips.map((t) => [t.id, t.capacity - t.carrying]))
  const upcoming = trips
    .filter((t) => t.departAt > now)
    .sort((a, b) => a.departAt.getTime() - b.departAt.getTime())

  const matches: { parcelId: string; tripId: string }[] = []
  for (const p of [...parcels].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const trip = upcoming.find(
      (t) => sameCity(t.fromCity, p.fromCity) && sameCity(t.toCity, p.toCity) && room.get(t.id)! > 0,
    )
    if (!trip) continue
    room.set(trip.id, room.get(trip.id)! - 1)
    matches.push({ parcelId: p.id, tripId: trip.id })
  }
  return matches
}

/**
 * The handover point in `city` closest to the drop-off pin.
 * No pin: the first point in the city, so a parcel is never stuck for want of a map tap.
 */
export function nearestPoint<P extends Point>(points: P[], city: string, lat?: number | null, lng?: number | null): P | undefined {
  const inCity = points.filter((p) => sameCity(p.city, city))
  if (lat == null || lng == null) return inCity[0]
  return inCity.reduce<P | undefined>(
    (best, p) => (!best || km(lat, lng, p.lat, p.lng) < km(lat, lng, best.lat, best.lng) ? p : best),
    undefined,
  )
}

/** Straight-line distance in km (haversine). Roads come later, if ever. */
export function km(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}
