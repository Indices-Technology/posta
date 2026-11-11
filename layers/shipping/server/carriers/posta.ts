/**
 * Posta's own network as a carrier: couriers to and from fulfilment centres, travellers between cities.
 *
 * Quote only. Booking a network parcel for a client goes through bookingService once the
 * /v1/shipments contract exists (docs/SHIPPING_MOVE.md step 5).
 *
 * Offered only when NUXT_NETWORK_QUOTES=true and an approved centre is within reach of both ends.
 * Two quotes: door (a courier delivers) and collect (the recipient collects at the centre).
 */
import type { IShippingProvider, Quote, ShipmentRequest } from './types'
import { hubRepository } from '~~/layers/hubs/server/repositories/hub.repository'
import { km } from '~~/layers/delivery/server/utils/matching'
import { networkPriceMinor } from '../utils/networkPrice'

/** Same reach as booking: farther than this from any centre, Posta doesn't serve the spot. */
const MAX_CENTRE_KM = 60
const MAX_WEIGHT_KG = 30

type Hub = Awaited<ReturnType<typeof hubRepository.listApproved>>[number]

function nearest(hubs: Hub[], a: ShipmentRequest['origin']): Hub | null {
  if (a.lat != null && a.lng != null) {
    let best: Hub | null = null
    let bestKm = MAX_CENTRE_KM
    for (const h of hubs) {
      const d = km(a.lat, a.lng, h.lat, h.lng)
      if (d <= bestKm) [best, bestKm] = [h, d]
    }
    return best
  }
  const city = a.city.trim().toLowerCase()
  return (city && hubs.find((h) => h.city.toLowerCase() === city)) || null
}

const weightOf = (req: ShipmentRequest) =>
  req.parcel?.weightKg ?? req.items.reduce((s, i) => s + (i.unitWeightKg ?? 0.5) * Math.max(1, i.qty), 0)

export const postaNetwork: IShippingProvider = {
  id: 'posta',
  name: 'Posta',
  capabilities: { cod: false, tracking: true, labelGeneration: false, insurance: false, international: false },
  policy: {
    claimsWindowHours: 24,
    liabilityCap: 'declared',
    returnTariffApplies: false,
    settlementModels: ['ESCROW_POD'],
    prohibitedItems: ['cash', 'dangerous goods', 'flammable liquids', 'live animals'],
    maxWeightKg: MAX_WEIGHT_KG,
  },

  canHandle(req) {
    return (
      useRuntimeConfig().networkQuotes === true &&
      req.origin.country.toUpperCase() === 'NG' &&
      req.destination.country.toUpperCase() === 'NG' &&
      weightOf(req) <= MAX_WEIGHT_KG
    )
  },

  async quote(req) {
    const hubs = await hubRepository.listApproved()
    const from = nearest(hubs, req.origin)
    const to = nearest(hubs, req.destination)
    if (!from || !to) return []

    const intercity = from.city.toLowerCase() !== to.city.toLowerCase()
    const weight = weightOf(req)
    // Intercity depends on a traveller making the trip, so the window is wide and honest.
    const eta = intercity ? { etaText: '2 to 5 days', etaMinHours: 48, etaMaxHours: 120 } : { etaText: '1 to 2 days', etaMinHours: 24, etaMaxHours: 48 }
    const quote = (door: boolean): Quote => {
      const price = networkPriceMinor(weight, intercity, door)
      return {
        carrierId: 'posta',
        carrierName: 'Posta',
        serviceLevel: door ? 'standard' : 'economy',
        rateRef: door ? 'door' : 'collect',
        costMinor: price,
        listMinor: price,
        buyerPriceMinor: price,
        currency: req.currency ?? 'NGN',
        ...eta,
        etaText: door ? eta.etaText : `${eta.etaText}, collect at ${to.name}`,
        codEligible: false,
      }
    }
    return [quote(true), quote(false)]
  },

  async book() {
    throw new Error('Booking Posta network parcels for clients is not available yet')
  },
  async track(trackingNumber) {
    return { carrierId: 'posta', trackingNumber, currentStatus: 'UNKNOWN', events: [] }
  },
  parseWebhook() {
    return null
  },
}
