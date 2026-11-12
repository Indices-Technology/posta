/** Shipment statuses: the carrier's (types.ts TrackingStatus) plus BOOKING while the carrier call runs. */
export const BOOKING = 'BOOKING'
export const TERMINAL = ['DELIVERED', 'RETURNED', 'FAILURE']

const RANK: Record<string, number> = {
  BOOKING: 0,
  UNKNOWN: 0,
  PRE_TRANSIT: 1,
  IN_TRANSIT: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
  RETURNED: 4,
  FAILURE: 4,
}

/** Does `next` move a shipment forward from `from`? Never out of an end state, never backwards. */
export function moves(from: string, next: string): boolean {
  if (TERMINAL.includes(from) || next === 'UNKNOWN') return false
  return (RANK[next] ?? 0) > (RANK[from] ?? 0)
}
