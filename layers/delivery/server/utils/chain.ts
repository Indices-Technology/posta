/**
 * The handover chain: the rules of who hands the parcel to whom. Pure, so it is tested alone;
 * services turn it into rows.
 *
 *   Sender ─▶ [pickup courier] ─▶ origin centre ─▶ traveller / city courier ─▶ destination centre
 *          ─▶ [door courier] ─▶ recipient           (or the recipient collects at the centre)
 *
 * The one rule: the person TAKING the parcel scans the giver's QR with their own dashboard, so
 * custody is confirmed by whoever now has it. The final recipient has no account, so they SHOW
 * their QR and the courier (or centre) scans it.
 */

export type Party = 'SENDER' | 'COURIER' | 'CENTRE' | 'TRAVELLER' | 'RECIPIENT'
export type FirstMile = 'DROP_OFF' | 'PICKUP'
export type LastMile = 'DOOR' | 'COLLECT'
export type LegKey = 'first' | 'middle' | 'last'
/** Who exactly a party is, resolved to ids when rows are written. */
export type Ref = 'sender' | 'origin' | 'dest' | 'recipient' | LegKey

export interface ChainLeg {
  key: LegKey
  kind: 'FIRST_MILE' | 'LINEHAUL' | 'LASTMILE'
  /** TRAVELLER legs are matched to trips; COURIER legs are dispatched to couriers. */
  carrier: 'TRAVELLER' | 'COURIER'
}

export interface ChainStep {
  seq: number
  from: { party: Party; ref: Ref }
  to: { party: Party; ref: Ref }
}

export const MAX_FAILED_ATTEMPTS = 5

const side = (party: Party, ref: Ref) => ({ party, ref })

/**
 * The chain for a booking.
 * `sameCentre`: origin and destination centre are the same shop (sender and recipient near each other).
 * `intercity`: centres in different cities, so the middle stretch is a traveller; in the same city
 * it is a courier between the two centres.
 */
export function buildChain(o: { firstMile: FirstMile; lastMile: LastMile; intercity: boolean; sameCentre: boolean }) {
  const legs: ChainLeg[] = []
  const hops: [ChainStep['from'], ChainStep['to']][] = []

  if (o.firstMile === 'PICKUP') {
    legs.push({ key: 'first', kind: 'FIRST_MILE', carrier: 'COURIER' })
    hops.push([side('SENDER', 'sender'), side('COURIER', 'first')], [side('COURIER', 'first'), side('CENTRE', 'origin')])
  } else {
    hops.push([side('SENDER', 'sender'), side('CENTRE', 'origin')])
  }

  if (!o.sameCentre) {
    const carrier = o.intercity ? 'TRAVELLER' : 'COURIER'
    legs.push({ key: 'middle', kind: 'LINEHAUL', carrier })
    hops.push([side('CENTRE', 'origin'), side(carrier, 'middle')], [side(carrier, 'middle'), side('CENTRE', 'dest')])
  }

  const lastCentre: Ref = o.sameCentre ? 'origin' : 'dest'
  if (o.lastMile === 'DOOR') {
    legs.push({ key: 'last', kind: 'LASTMILE', carrier: 'COURIER' })
    hops.push([side('CENTRE', lastCentre), side('COURIER', 'last')], [side('COURIER', 'last'), side('RECIPIENT', 'recipient')])
  } else {
    hops.push([side('CENTRE', lastCentre), side('RECIPIENT', 'recipient')])
  }

  return { legs, steps: hops.map(([from, to], i): ChainStep => ({ seq: i + 1, from, to })) }
}

/** Who confirms a handover by scanning: the taker, except the recipient, who shows instead. */
export const confirmer = (from: Party, to: Party): 'from' | 'to' => (to === 'RECIPIENT' ? 'from' : 'to')

/**
 * The parcel's status once a handover is done.
 * `toFinalCentre`: the centre receiving it is the last one before the recipient.
 */
export function statusAfter(
  h: { toParty: Party; toFinalCentre: boolean; toLegKind?: string | null },
  lastMile: LastMile,
): string {
  switch (h.toParty) {
    case 'COURIER':
      if (h.toLegKind === 'FIRST_MILE') return 'WITH_COURIER'
      if (h.toLegKind === 'LINEHAUL') return 'IN_TRANSIT'
      return 'OUT_FOR_DELIVERY'
    case 'TRAVELLER':
      return 'IN_TRANSIT'
    case 'CENTRE':
      if (!h.toFinalCentre) return 'AT_ORIGIN'
      return lastMile === 'COLLECT' ? 'READY_FOR_COLLECTION' : 'AT_HUB'
    case 'RECIPIENT':
      return 'DELIVERED'
    default:
      return 'NEW'
  }
}

export const initialStatus = (firstMile: FirstMile) => (firstMile === 'PICKUP' ? 'AWAITING_PICKUP' : 'AWAITING_DROPOFF')

/**
 * Which handover is READY now: the first one not done, if both its sides have someone assigned
 * (a carrier leg needs its courier or trip). Everything after it waits.
 */
export function readiness<H extends { seq: number; status: string; fromAssigned: boolean; toAssigned: boolean }>(
  handovers: H[],
): Map<number, 'WAITING' | 'READY' | 'DONE' | 'CANCELLED'> {
  const out = new Map<number, 'WAITING' | 'READY' | 'DONE' | 'CANCELLED'>()
  let blocked = false
  for (const h of [...handovers].sort((a, b) => a.seq - b.seq)) {
    if (h.status === 'DONE' || h.status === 'CANCELLED') {
      out.set(h.seq, h.status)
      continue
    }
    out.set(h.seq, !blocked && h.fromAssigned && h.toAssigned ? 'READY' : 'WAITING')
    blocked = true
  }
  return out
}
