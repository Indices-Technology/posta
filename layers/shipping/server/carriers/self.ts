/**
 * Self-shipping / Bring-Your-Own-Shipping (BYOS) provider.
 *
 * Not a real carrier — the seller delivers (own rider, hand-delivery, their own
 * courier account) or offers pickup. Pricing is **seller-defined** and travels
 * in the request (`req.sellerShipping`); tracking is **manual** (the seller
 * updates order status). Settlement stays MarketX Escrow POD — buyer protection
 * is unchanged. No carrier wallet/return-tariff. See docs/SHIPPING.md.
 */

import type {
  IShippingProvider,
  ShipmentRequest,
  Quote,
  BookRequest,
  ShipmentResult,
  TrackingResult,
  TrackingUpdate,
  CarrierPolicy,
} from './types'
import { resolveZone } from './zone'

const selfPolicy: CarrierPolicy = {
  claimsWindowHours: 24,
  liabilityCap: 'declared',
  returnTariffApplies: false, // seller bears their own logistics
  settlementModels: ['ESCROW_POD'],
  prohibitedItems: [],
  maxWeightKg: Number.POSITIVE_INFINITY,
}

function deliveryAmountMinor(req: ShipmentRequest): number {
  const cfg = req.sellerShipping!
  // Free over a threshold
  if (cfg.freeOverMinor != null && (req.subtotalMinor ?? 0) >= cfg.freeOverMinor) {
    return 0
  }
  // Per-zone flat, if configured for this origin→destination zone
  if (cfg.zoneRates) {
    const zone = resolveZone(req.origin.state, req.destination.state)
    const z = cfg.zoneRates[zone]
    if (z != null) return Math.max(0, Math.round(z))
  }
  // Otherwise the flat rate (default 0 = free if seller set nothing)
  return Math.max(0, Math.round(cfg.flatRateMinor ?? 0))
}

export const selfProvider: IShippingProvider = {
  id: 'self',
  name: 'Seller delivery',
  capabilities: {
    cod: true,
    tracking: true, // manual
    labelGeneration: false,
    insurance: false,
    international: false,
  },
  policy: selfPolicy,

  canHandle(req: ShipmentRequest): boolean {
    return req.sellerShipping?.selfEnabled === true
  },

  async quote(req: ShipmentRequest): Promise<Quote[]> {
    const cfg = req.sellerShipping!
    const currency = req.currency ?? 'NGN'
    const quotes: Quote[] = []

    // Seller-delivered option. When the seller collects the fee as cash on
    // delivery, nothing is charged online (buyerPriceMinor 0) and the fee travels
    // as codAmountMinor — the buyer hands it to the rider on arrival.
    const amount = deliveryAmountMinor(req)
    if (cfg.payDriverEnabled) {
      quotes.push({
        carrierId: 'self',
        carrierName: 'Pay the rider on delivery',
        serviceLevel: 'standard',
        rateRef: 'cod',
        costMinor: 0,
        listMinor: 0,
        buyerPriceMinor: 0, // nothing charged online — paid in cash on delivery
        payOnDelivery: true,
        codAmountMinor: amount,
        currency,
        etaText: cfg.etaText || 'Delivered by the seller',
        codEligible: true,
      })
    } else {
      quotes.push({
        carrierId: 'self',
        carrierName: 'Seller delivery',
        serviceLevel: 'standard',
        costMinor: amount, // seller sets the price; no platform markup
        listMinor: amount,
        buyerPriceMinor: amount,
        currency,
        etaText: cfg.etaText || 'Delivered by the seller',
        codEligible: true,
      })
    }

    // Pickup option (free), if the seller offers it
    if (cfg.pickupEnabled) {
      quotes.push({
        carrierId: 'self',
        carrierName: 'Pickup from seller',
        serviceLevel: 'economy',
        rateRef: 'pickup',
        costMinor: 0,
        listMinor: 0,
        buyerPriceMinor: 0,
        currency,
        etaText: cfg.pickupNote || 'Collect in person, arranged with the seller',
        codEligible: true,
      })
    }

    return quotes
  },

  async book(req: BookRequest): Promise<ShipmentResult> {
    // No carrier booking — create a manual shipment the seller fulfils & updates.
    return {
      carrierId: 'self',
      trackingNumber: `SELF-${req.orderRef}`,
      costMinor: 0,
      buyerPriceMinor: 0,
      currency: req.request.currency ?? 'NGN',
      etaText: req.request.sellerShipping?.etaText || 'Delivered by the seller',
    }
  },

  async track(trackingNumber: string): Promise<TrackingResult> {
    // Manual — status is driven by the seller's order-status updates, not a carrier.
    return {
      carrierId: 'self',
      trackingNumber,
      currentStatus: 'UNKNOWN',
      events: [],
    }
  },

  parseWebhook(_payload: unknown): TrackingUpdate | null {
    return null // no webhooks for self-shipping
  },
}
