/**
 * Nigeria's national postcode (https://docs.postcode.gov.ng/concepts/postcode-format):
 * 12 characters in 5 segments, e.g. FC-01-A01-KP-27
 *   FC  state (2 letters) · 01 LGA (2 digits) · A01 district (3 alphanumeric)
 *   KP  area (2 letters)  · 27 building unit (2 digits)
 * We store and show the dashed form; people may type it with spaces, dashes or neither.
 */
const SHAPE = /^([A-Z]{2})(\d{2})([A-Z0-9]{3})([A-Z]{2})(\d{2})$/

/** Canonical dashed form, or null if it isn't shaped like a national postcode. */
export function normalizePostcode(input: string): string | null {
  const m = input.toUpperCase().replace(/[\s-]/g, '').match(SHAPE)
  return m ? m.slice(1).join('-') : null
}

export const postcodeState = (canonical: string) => canonical.slice(0, 2)

/** Where the map opens for a city, [lng, lat]. Unknown cities open on Nigeria as a whole. */
export const CITY_CENTRES: Record<string, [number, number]> = {
  lagos: [3.3792, 6.5244],
  abuja: [7.4951, 9.0579],
  jos: [8.8921, 9.9285],
  kano: [8.5167, 12.0022],
  ibadan: [3.947, 7.3775],
  'port harcourt': [7.0134, 4.8156],
  kaduna: [7.4384, 10.5222],
  enugu: [7.4951, 6.4584],
  benin: [5.6037, 6.335],
}
export const cityCentre = (city?: string | null) => (city ? CITY_CENTRES[city.trim().toLowerCase()] : undefined)
