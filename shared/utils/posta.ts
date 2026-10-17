// Wording and formatting shared by server and pages, so a status reads the same everywhere.

export type ParcelStatusName = 'NEW' | 'MATCHED' | 'IN_TRANSIT' | 'AT_HUB' | 'OUT_FOR_DELIVERY' | 'DELIVERED'
export type Tone = 'neutral' | 'ink' | 'ok' | 'alert'

export const PARCEL_STATUS: Record<ParcelStatusName, { label: string; tone: Tone }> = {
  NEW: { label: 'Waiting for a trip', tone: 'neutral' },
  MATCHED: { label: 'Matched', tone: 'ink' },
  IN_TRANSIT: { label: 'On the road', tone: 'ink' },
  AT_HUB: { label: 'At handover point', tone: 'ink' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'ink' },
  DELIVERED: { label: 'Delivered', tone: 'ok' },
}

export const PARCEL_VIEWS = {
  waiting: ['NEW'],
  moving: ['MATCHED', 'IN_TRANSIT', 'AT_HUB', 'OUT_FOR_DELIVERY'],
  delivered: ['DELIVERED'],
} as const satisfies Record<string, ParcelStatusName[]>
export type ParcelView = keyof typeof PARCEL_VIEWS

export const TRIP_STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: 'Taking parcels', tone: 'ink' },
  FULL: { label: 'Full', tone: 'neutral' },
  DONE: { label: 'Completed', tone: 'ok' },
}

export const formatRef = (n: number) => `#${n}`

const TZ = 'Africa/Lagos'
export const formatDateTime = (d: string | Date) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(d))
export const formatTime = (d: string | Date) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(d))
export const formatDay = (d: string | Date) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(d))
export const formatNaira = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(kobo / 100)
export const formatCode = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`

/**
 * One line of a parcel's history. `forPublic` hides who carried it (tracking page).
 * Returns null for events that would only repeat the line before them.
 */
export function eventText(type: string, data: Record<string, any> = {}, forPublic = false): string | null {
  switch (type) {
    case 'parcel.created':
      return 'Parcel registered'
    case 'parcel.matched':
      return forPublic ? 'Matched to a trip' : `Matched to ${data.driver ?? 'a driver'}'s trip. Hands over at ${data.hub ?? data.postcode}`
    case 'leg.collected':
      if (data.legSeq === 2) return forPublic ? 'Out for delivery' : `Picked up by courier ${data.by}`
      return forPublic ? 'Collected by the driver' : `Collected by ${data.by}`
    case 'handover.completed':
      return data.legSeq === 2 ? null : `Handed over at ${data.place ?? data.postcode}`
    case 'lastmile.created':
      return forPublic ? null : `Courier ${data.courier} assigned`
    case 'parcel.delivered':
      return forPublic ? 'Delivered' : 'Delivered to the recipient'
    default:
      return null
  }
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name
