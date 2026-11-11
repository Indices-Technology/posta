import type { CarrierPolicy } from '../types'

/** GIG Logistics policy — derived from the GIG SLA (see docs/SHIPPING.md §13). */
export const gigPolicy: CarrierPolicy = {
  claimsWindowHours: 24, // §10.3
  liabilityCap: 'declared', // §10.2 — limited to declared value
  returnTariffApplies: true, // §1.10, §9
  settlementModels: ['ESCROW_POD', 'CARRIER_COD'],
  // GIG (Jul 2026, confirmed by GIGL): COD is reconciled DAILY and paid out
  // "at least twice weekly" — i.e. ~every 3–4 days, not the weekly cadence the
  // SLA §4.6 implies. Budget the slower end so payout expectations never overrun.
  codRemittanceDays: 4,
  maxWeightKg: 200, // Annexure 2 tops out at 200kg
  prohibitedItems: [
    'cash',
    'dangerous goods',
    'flammable liquids',
    'flammable solids',
    'gases',
    'oxidizers',
    'organic peroxides',
    'corrosive materials',
    'radioactive materials',
    'poisonous or infectious substances',
  ],
}
