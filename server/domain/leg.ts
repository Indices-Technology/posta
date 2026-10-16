/**
 * How a parcel moves, as a pure function: no database, no I/O.
 * leg.service.ts turns the plan into writes.
 *
 * A parcel has two legs. Leg 1 (LINEHAUL) is the driver's trip, leg 2 (LASTMILE) the courier.
 * Each leg only moves forward: ASSIGNED → COLLECTED → HANDED_OVER.
 *
 * Proof rule: the person RECEIVING the parcel holds the code, the carrier types it in.
 *   collect:  the sender (or hub) reads the carrier the leg's collectCode
 *   handover: the receiver (hub or customer) reads the carrier the leg's handoverCode
 * So a carrier can only have the code if they stood in front of that person.
 */
import { timingSafeEqual } from 'node:crypto'

export type LegStatus = 'ASSIGNED' | 'COLLECTED' | 'HANDED_OVER'
export type LegKind = 'LINEHAUL' | 'LASTMILE'
export type ParcelStatus = 'NEW' | 'MATCHED' | 'IN_TRANSIT' | 'AT_HUB' | 'OUT_FOR_DELIVERY' | 'DELIVERED'
export type LegAction = 'collect' | 'handover'

export const MAX_FAILED_ATTEMPTS = 5

export interface LegState {
  kind: LegKind
  status: LegStatus
  collectCode: string
  handoverCode: string
  failedAttempts: number
}

export type LegPlan =
  | {
      ok: true
      legStatus: LegStatus
      parcelStatus: ParcelStatus
      /** Event types to record, in order. */
      events: string[]
      /** Leg 1 handed over at the hub: create the last-mile leg now. */
      openLastMile: boolean
    }
  | { ok: false; reason: 'not_yet' | 'already_done' | 'wrong_code' | 'locked'; attemptsLeft: number }

const STEP: Record<LegAction, { from: LegStatus; to: LegStatus }> = {
  collect: { from: 'ASSIGNED', to: 'COLLECTED' },
  handover: { from: 'COLLECTED', to: 'HANDED_OVER' },
}

// What the parcel as a whole becomes after each step of each leg.
const PARCEL_AFTER: Record<LegKind, Record<LegAction, ParcelStatus>> = {
  LINEHAUL: { collect: 'IN_TRANSIT', handover: 'AT_HUB' },
  LASTMILE: { collect: 'OUT_FOR_DELIVERY', handover: 'DELIVERED' },
}

export function planLegAction(leg: LegState, action: LegAction, code: string): LegPlan {
  const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - leg.failedAttempts)
  if (attemptsLeft === 0) return { ok: false, reason: 'locked', attemptsLeft }
  if (leg.status !== STEP[action].from) {
    const early = action === 'handover' && leg.status === 'ASSIGNED'
    return { ok: false, reason: early ? 'not_yet' : 'already_done', attemptsLeft }
  }

  const expected = action === 'collect' ? leg.collectCode : leg.handoverCode
  if (!sameCode(code.trim(), expected)) {
    return { ok: false, reason: 'wrong_code', attemptsLeft: attemptsLeft - 1 }
  }

  const events =
    action === 'collect'
      ? ['leg.collected']
      : leg.kind === 'LINEHAUL'
        ? ['handover.completed', 'lastmile.created']
        : ['handover.completed', 'parcel.delivered']

  return {
    ok: true,
    legStatus: STEP[action].to,
    parcelStatus: PARCEL_AFTER[leg.kind][action],
    events,
    openLastMile: leg.kind === 'LINEHAUL' && action === 'handover',
  }
}

// Constant-time compare, so response timing gives nothing away about the code.
function sameCode(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
