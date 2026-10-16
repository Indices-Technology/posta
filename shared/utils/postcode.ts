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
