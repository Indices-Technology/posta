/**
 * Platform shipping pricing — the cost→retail dial.
 *
 * Providers return `costMinor` (what we pay) and `listMinor` (reference/retail).
 * The platform decides how much of the spread the buyer keeps via a single
 * admin-tunable knob. See docs/SHIPPING.md §6.
 *
 *   buyerPrice     = list − discountPct × (list − cost)
 *   platformMargin = buyerPrice − cost
 *
 * discountPct = 0   → buyer pays list (full margin, default)
 * discountPct = 1   → buyer pays cost (cheapest, zero margin)
 *
 * Config (per-carrier / per-zone / promo) will come from the `CarrierConfig`
 * table; until then callers pass an explicit discountPct (default 0).
 */

/**
 * Platform markup applied to CARRIER cost (GIG today, any carrier we onboard next).
 * Provider-agnostic — set once via env, not per-carrier. Seller-priced BYOS
 * ('self') is passed through untouched by the orchestrator.
 *   SHIPPING_MARKUP_PCT    fraction on cost, e.g. 0.25 → buyer pays cost × 1.25
 *   SHIPPING_HANDLING_FEE  optional flat NGN added per carrier shipment (default 0)
 */
export const DEFAULT_MARKUP = 0.25

/** Global carrier markup (fraction), from env; falls back to DEFAULT_MARKUP. */
export function shippingMarkupPct(): number {
  const n = Number(process.env.SHIPPING_MARKUP_PCT)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MARKUP
}

/** Global flat handling fee in MINOR units (kobo), from env (major NGN); default 0. */
export function shippingHandlingFeeMinor(): number {
  const n = Number(process.env.SHIPPING_HANDLING_FEE)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}

export interface PricingInput {
  costMinor: number
  /** Reference/retail price. When absent + deriveList, computed from cost. */
  listMinor?: number
  /** 0..1 — fraction of the (list − cost) spread passed to the buyer as discount. */
  discountPct?: number
  /** When listMinor is absent, derive it as cost × (1 + markup) + handling fee. */
  deriveList?: boolean
  markup?: number
  /** Flat fee (minor) added to the derived list — carrier handling. */
  handlingFeeMinor?: number
  /**
   * Pass-through insurance premium (minor) baked into costMinor. Excluded from
   * the markup — the platform doesn't profit on the carrier's insurance — and
   * added back to the buyer price at cost.
   */
  insuranceMinor?: number
}

export interface PricingResult {
  costMinor: number
  listMinor: number
  buyerPriceMinor: number
  platformMarginMinor: number
}

export function computePrice(input: PricingInput): PricingResult {
  const cost = Math.max(0, Math.round(input.costMinor))
  const markup = input.markup ?? DEFAULT_MARKUP

  const fee = Math.max(0, Math.round(input.handlingFeeMinor ?? 0))
  // Insurance is a pass-through premium inside cost: mark up only the carriage,
  // then add insurance back at cost so the platform never profits on it.
  const insurance = Math.min(cost, Math.max(0, Math.round(input.insuranceMinor ?? 0)))
  const carriage = cost - insurance
  const list =
    input.listMinor != null
      ? Math.round(input.listMinor)
      : input.deriveList
        ? Math.round(carriage * (1 + markup)) + fee + insurance
        : cost

  const discountPct = clamp01(input.discountPct ?? 0)
  const spread = Math.max(0, list - cost)
  const buyerPrice = Math.round(list - discountPct * spread)

  return {
    costMinor: cost,
    listMinor: list,
    buyerPriceMinor: buyerPrice,
    platformMarginMinor: buyerPrice - cost,
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
}
