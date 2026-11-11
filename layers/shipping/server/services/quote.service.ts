/**
 * Delivery quotes for a client: ask every eligible carrier at once, price, rank.
 *
 *   carriers allowed by the client → canHandle → quote in parallel (a slow carrier drops out)
 *   → markup on carrier cost (never on seller-priced or Posta network quotes) → filter by mode → rank
 */
import type { IShippingProvider, Quote, ShipmentRequest } from '../carriers/types'
import { gigProvider } from '../carriers/gig'
import { selfProvider } from '../carriers/self'
import { postaNetwork } from '../carriers/posta'
import { computePrice, shippingHandlingFeeMinor, shippingMarkupPct } from '../carriers/pricing'
import { rankQuotes } from '../utils/rank'
import type { QuoteInput } from '../schemas/quote.schema'

const PROVIDERS: IShippingProvider[] = [selfProvider, gigProvider, postaNetwork]
/** Prices that are someone else's to set: the seller's own delivery, and Posta's network card. */
const PASS_THROUGH = new Set(['self', 'posta'])
// ponytail: one timeout for every carrier. A cold GIG quote (login + stations + 2 prices) took 5.8s
// locally; MarketX waits 10s in total, so this stays under it with room for the request itself.
const CARRIER_TIMEOUT_MS = 7_500

export type Delivery = 'door' | 'collect'
const deliveryOf = (q: Quote): Delivery => (q.rateRef === 'pickup' || q.rateRef === 'collect' ? 'collect' : 'door')

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('quote timeout')), ms))])
}

export const quoteService = {
  async quote(input: QuoteInput) {
    const req: ShipmentRequest = {
      origin: input.origin,
      destination: input.destination,
      items: [{ qty: 1, unitWeightKg: input.parcel.weightKg }],
      parcel: input.parcel,
      declaredValueMinor: input.declaredValueMinor,
      subtotalMinor: input.subtotalMinor,
      currency: 'NGN',
      sellerShipping: input.sellerShipping,
    }

    const allowed = new Set<string>(input.carriers ?? PROVIDERS.map((p) => p.id))
    const providers = PROVIDERS.filter((p) => {
      if (!allowed.has(p.id)) return false
      try {
        return p.canHandle(req)
      } catch {
        return false
      }
    })

    const settled = await Promise.allSettled(providers.map((p) => withTimeout(p.quote(req), CARRIER_TIMEOUT_MS)))

    const options = settled.flatMap((result, i) => {
      const provider = providers[i]!
      if (result.status === 'rejected') {
        logger.warn(`[quotes] ${provider.id} dropped out`, { error: String(result.reason) })
        return []
      }
      return result.value.map((q) => {
        const passThrough = PASS_THROUGH.has(q.carrierId)
        const priced = passThrough
          ? { buyerPriceMinor: q.buyerPriceMinor }
          : computePrice({
              costMinor: q.costMinor,
              deriveList: true,
              markup: shippingMarkupPct(),
              handlingFeeMinor: shippingHandlingFeeMinor(),
              insuranceMinor: q.insuranceMinor,
            })
        const covered = (q.insuranceMinor ?? 0) > 0
        return {
          id: `${q.carrierId}-${q.rateRef ?? q.serviceLevel}`,
          carrier: { id: q.carrierId, name: q.carrierName },
          service: q.serviceLevel,
          delivery: deliveryOf(q),
          rateRef: q.rateRef ?? null,
          /** Charged online. */
          priceMinor: priced.buyerPriceMinor,
          /** Part of priceMinor that is the carrier's insurance premium, passed on at cost. */
          insuranceMinor: q.insuranceMinor ?? 0,
          /** The delivery fee is cash to the rider on arrival (can be 0 when the seller delivers free). */
          payOnDelivery: q.payOnDelivery === true,
          /** Cash the recipient hands the rider on arrival, not charged online. */
          payOnDeliveryMinor: q.payOnDelivery ? (q.codAmountMinor ?? 0) : 0,
          currency: q.currency,
          eta: { text: q.etaText, minHours: q.etaMinHours ?? null, maxHours: q.etaMaxHours ?? null },
          insurance: {
            covered,
            coverMinor: covered ? req.declaredValueMinor : 0,
            claimsWindowHours: provider.policy.claimsWindowHours,
          },
        }
      })
    })

    const wanted = input.mode ? options.filter((o) => o.delivery === input.mode) : options
    const ranked = rankQuotes(
      wanted.map((o) => ({
        ...o,
        // Ranking sees the full cost to the buyer, cash on arrival included.
        totalMinor: o.priceMinor + o.payOnDeliveryMinor,
        etaMaxHours: o.eta.maxHours ?? undefined,
        coverMinor: o.insurance.coverMinor,
      })),
      input.strategy,
    )

    return {
      strategy: input.strategy,
      quotes: ranked.map(({ totalMinor, etaMaxHours, coverMinor, ...q }) => q),
    }
  },
}
