/**
 * A map point from what people paste: a Google/Apple Maps link or "lat, lng".
 * Pure, so it can be tested without the network; short links are expanded in address.service.
 */
export interface LatLng {
  lat: number
  lng: number
}

// Most precise first: !3d!4d is the dropped pin, @lat,lng is only where the map was looking.
const PATTERNS = [
  /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
  /[?&](?:q|query|ll|destination|daddr|center)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
  /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/,
]

export const inNigeria = (p: LatLng) => p.lat >= 4 && p.lat <= 14 && p.lng >= 2.5 && p.lng <= 15

/** The point in a link or "lat, lng" text, or null. Points outside Nigeria count as none. */
export function pointIn(text: string): LatLng | null {
  let s = text
  try {
    s = decodeURIComponent(text)
  } catch {
    /* keep it as typed */
  }
  for (const re of PATTERNS) {
    const m = s.match(re)
    if (m) {
      const p = { lat: Number(m[1]), lng: Number(m[2]) }
      return inNigeria(p) ? p : null
    }
  }
  return null
}

/** Share links that hide the point behind one redirect. Only these hosts are ever fetched. */
export const SHORT_LINK_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'maps.apple'])

/** found: safe to save without asking · check: show it and ask "is this your building?" · none: keep the typed address */
export type ResolveStatus = 'found' | 'check' | 'none'
export type Source = 'postcode' | 'gps' | 'link' | 'text'

/**
 * Only a precise point is "found". A typed street lands on the street, so the nearest
 * building is a neighbour's: right area, wrong door. The person must confirm those.
 */
export function statusOf(source: Source, confidence: string | undefined, exactText: boolean): ResolveStatus {
  if (confidence !== 'high') return 'check'
  return source === 'text' && !exactText ? 'check' : 'found'
}
