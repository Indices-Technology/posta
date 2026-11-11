/**
 * GIG rate model — placeholder.
 *
 * The real Annexure-2 card (0.5–200kg × 4 zones × {Class, Basic}, with tier
 * breaks) will be seeded into the `CarrierRate` DB table and read from there.
 * Until then this is a faithful **linear approximation** of the early tiers:
 * base price @0.5kg + a per-half-kg increment, derived from the SLA's first two
 * rows of each zone/plan. Replace with the DB lookup — do not extend this by hand.
 *
 * CLASS  = our cost (negotiated).   BASIC = retail anchor (~17–21% higher).
 * All figures are NGN (VAT-inclusive per the SLA).
 */

import type { ZoneCode } from '../zone'

type Plan = 'CLASS' | 'BASIC'

interface RateModel {
  baseAtHalfKg: number // price for the first 0.5kg
  perHalfKg: number // increment per additional 0.5kg
}

const MODEL: Record<Plan, Record<ZoneCode, RateModel>> = {
  CLASS: {
    Z1: { baseAtHalfKg: 4301, perHalfKg: 800.4 },
    Z2: { baseAtHalfKg: 5497, perHalfKg: 799.25 },
    Z3: { baseAtHalfKg: 6395.15, perHalfKg: 800.4 },
    Z4: { baseAtHalfKg: 7693.5, perHalfKg: 800.4 },
  },
  BASIC: {
    Z1: { baseAtHalfKg: 5204.9, perHalfKg: 979.8 },
    Z2: { baseAtHalfKg: 6668.85, perHalfKg: 979.8 },
    Z3: { baseAtHalfKg: 7769.4, perHalfKg: 979.8 },
    Z4: { baseAtHalfKg: 9359.85, perHalfKg: 979.8 },
  },
}

/** Returns the GIG rate in NGN for a plan/zone/weight. */
export function gigRateNGN(plan: Plan, zone: ZoneCode, weightKg: number): number {
  const m = MODEL[plan][zone]
  const halfKgSteps = Math.max(1, Math.ceil((weightKg || 0.5) / 0.5))
  return Math.round((m.baseAtHalfKg + (halfKgSteps - 1) * m.perHalfKg) * 100) / 100
}

/** GoFaster Express surcharge over the standard rate (placeholder). */
export const EXPRESS_SURCHARGE = 0.35
