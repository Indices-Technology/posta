/**
 * GIG Logistics provider — domestic Nigeria.
 *
 * Quoting: when GIG credentials are configured, calls the live `/price` API
 * (resolving sender/receiver stations from state). If GIG is unconfigured or the
 * call fails, falls back to the static Annexure-2 rate card. Booking uses
 * `/capture/preshipment` (returns a Waybill); tracking uses `/track/mobileShipment`.
 * See docs/SHIPPING.md §4, §7, §13.
 */

import type {
  IShippingProvider,
  ShipmentRequest,
  Quote,
  BookRequest,
  ShipmentResult,
  TrackingResult,
  TrackingEvent,
  TrackingStatus,
  TrackingUpdate,
} from '../types'
import { resolveZone, ZONE_ETA } from '../zone'
import { gigRateNGN } from './rates'
import { gigPolicy } from './policy'
import {
  isGigConfigured,
  isGigEnabled,
  gigCustomerCode,
  gigCustomerType,
  fetchPrice,
  fetchDropoffPrice,
  capturePreshipment,
  captureDropoff,
  trackShipment as gigTrack,
  type GigPriceResult,
} from './client'
import { resolveStation, resolveServiceCentre, locationFor } from './stations'

const NGN = (naira: number) => Math.round(naira * 100) // → kobo (minor units)

function totalWeightKg(req: ShipmentRequest): number {
  if (req.parcel?.weightKg) return req.parcel.weightKg
  const sum = req.items.reduce(
    (acc, it) => acc + (it.unitWeightKg ?? 0.5) * Math.max(1, it.qty),
    0,
  )
  return sum > 0 ? sum : 0.5
}

/**
 * GIG scan-status codes → our normalized status, from GIG's published scan list.
 *
 * The two transitions that matter gate real money/UX, so their sets are exact:
 *  • PRE_TRANSIT — the parcel is NOT yet in GIG's hands (created / awaiting or
 *    en-route-to collection). These must NOT flip the order to SHIPPED. Critically
 *    DLP = "delayed PICKUP" (still with the seller) and MENP = "enroute pickup"
 *    (rider on the way TO collect) belong here — the old default mapped them to
 *    IN_TRANSIT and would have marked an order shipped before GIG ever collected.
 *  • Possession (→ IN_TRANSIT → SHIPPED) — MPIK "picked up" is the authoritative
 *    pickup signal; SRFS "received from store to GIG hub/centre" is the authoritative
 *    DROP-OFF signal. Any hub/transit scan also implies GIG physically holds it.
 *  • DELIVERED gates the seller payout (walletService.releaseFundsOnDelivery) — kept
 *    to the four true delivery codes. "Arrived final destination" (MAFD/ARF/AHD) is
 *    NOT delivery; it stays IN_TRANSIT so we never pay out on an arrival scan.
 *  • RETURNED / FAILURE — hold funds, alert the seller.
 * Unrecognized codes default to IN_TRANSIT (see mapStatus): a safe assumption of
 * movement that can never, by construction, reach DELIVERED/RETURNED/FAILURE.
 */
const GIG_STATUS: Record<string, TrackingStatus> = {
  // ── Created / awaiting or en-route-to collection — NOT yet with GIG ──────────
  CRT: 'PRE_TRANSIT', // created at service centre (1st scan)
  MCRT: 'PRE_TRANSIT', // created by customer
  CRH: 'PRE_TRANSIT', // created (home-delivery email)
  CRTUK: 'PRE_TRANSIT',
  CRTGH: 'PRE_TRANSIT',
  CRTGF: 'PRE_TRANSIT',
  MAPT: 'PRE_TRANSIT', // assigned for pickup (accepted, not collected)
  MENP: 'PRE_TRANSIT', // enroute pickup (rider going TO collect)
  APFS: 'PRE_TRANSIT', // attempted pickup from sender
  DLP: 'PRE_TRANSIT', // DELAYED PICKUP — still with the seller

  // ── Possession confirmed — GIG now physically holds the parcel (→ SHIPPED) ───
  MPIK: 'IN_TRANSIT', // SHIPMENT PICKED UP — pickup possession signal
  PICKED: 'IN_TRANSIT', // picked up for delivery
  SRFS: 'IN_TRANSIT', // received from store to GIG hub/centre — DROP-OFF possession
  // Hub / transit movement — parcel is definitively in the network.
  ARP: 'IN_TRANSIT',
  APT: 'IN_TRANSIT',
  ARO: 'IN_TRANSIT',
  AST: 'IN_TRANSIT',
  DTR: 'IN_TRANSIT',
  DST: 'IN_TRANSIT',
  DSC: 'IN_TRANSIT',
  DPC: 'IN_TRANSIT',
  MDSE: 'IN_TRANSIT',
  MSVC: 'IN_TRANSIT',
  ADF: 'IN_TRANSIT',
  ACC: 'IN_TRANSIT',
  DCC: 'IN_TRANSIT',
  TRO: 'IN_TRANSIT',
  GOP: 'IN_TRANSIT',
  MRTD: 'IN_TRANSIT', // rerouted
  MRR: 'IN_TRANSIT', // misrouted (still in the network)
  AD: 'IN_TRANSIT', // daily arrival scan at destination
  // Arrived at the destination centre — awaiting delivery, NOT delivered yet.
  MAFD: 'IN_TRANSIT',
  ARF: 'IN_TRANSIT',
  AHD: 'IN_TRANSIT',
  // Post-possession delay / attempt — parcel is live, a later scan resolves it.
  DLD: 'IN_TRANSIT', // delivery delayed
  DUBC: 'IN_TRANSIT', // delayed pickup BY CUSTOMER at terminal
  ATD: 'IN_TRANSIT', // delivery attempted
  OVDSHP: 'IN_TRANSIT', // overdue
  FMS: 'IN_TRANSIT', // found missing shipment

  // ── With the delivery courier / en route to the buyer ───────────────────────
  OFDU: 'OUT_FOR_DELIVERY',
  WC: 'OUT_FOR_DELIVERY',
  MSHC: 'OUT_FOR_DELIVERY',

  // ── Reached the buyer (incl. terminal collection) — gates payout, keep exact ─
  SHD: 'DELIVERED',
  MAHD: 'DELIVERED',
  OKC: 'DELIVERED',
  OKT: 'DELIVERED', // collected by customer at terminal

  // ── Coming back to us ────────────────────────────────────────────────────────
  MRTE: 'RETURNED',
  SRHUB: 'RETURNED',
  SSR: 'RETURNED',
  SRC: 'RETURNED',
  RSR: 'RETURNED',
  VFSSRR: 'RETURNED',
  RTNINIT: 'RETURNED',

  // ── Terminal failures — an order that can no longer be fulfilled ─────────────
  DFA: 'FAILURE',
  FID: 'FAILURE',
  MSCC: 'FAILURE',
  MSCP: 'FAILURE',
  SSC: 'FAILURE',
  SDR: 'FAILURE',
  DASH: 'FAILURE',
  CLS: 'FAILURE',
  SMIM: 'FAILURE',
}

/** Any other scan means the parcel moved — treat it as in transit. */
function mapStatus(code: string): TrackingStatus {
  const c = (code || '').trim().toUpperCase()
  if (!c) return 'UNKNOWN'
  return GIG_STATUS[c] ?? 'IN_TRANSIT'
}

async function liveQuote(req: ShipmentRequest): Promise<Quote[] | null> {
  const [sender, receiver] = await Promise.all([
    resolveStation(req.origin.state),
    resolveStation(req.destination.state),
  ])
  if (!sender || !receiver) return null // can't price without stations → fall back

  const weight = totalWeightKg(req)
  const valueMajor = (req.declaredValueMinor || 0) / 100
  // Weight-priced regular item. ShipmentType 0 = "special package" — a
  // predefined GIG package whose FIXED weight overrides ours (id 1 = 12.5kg),
  // which made every quote come back as 12.5kg. ShipmentType 1 prices by the
  // actual Weight and requires ItemName + IsVolumetric.
  const shipmentItems = [
    {
      Quantity: 1,
      ShipmentType: 1,
      ItemName: 'Merchandise',
      IsVolumetric: false,
      Weight: weight,
      Value: valueMajor,
    },
  ]

  // Quote BOTH fulfilment paths and charge the buyer the higher of the two:
  //  • pickup  (/price)         — GIG collects from the seller (has a PickupCharge)
  //  • dropoff (/dropOff/price) — seller brings it to a GIG service centre
  // The two are priced independently and neither is reliably cheaper, so taking
  // the max means the buyer's payment covers EITHER method the seller chooses at
  // fulfilment time (pickup, or dropoff as a fallback if GIG never collects).
  // Both calls are best-effort: if one fails we use the other; only if BOTH fail
  // does the caller fall back to the static rate card. PickUpOptions 0 =
  // HomeDelivery (deliver to the buyer's address) for both; the pickup-vs-dropoff
  // distinction is the endpoint, not this flag (which is the receiver-side option).
  const [pickupRes, dropoffRes] = await Promise.allSettled([
    fetchPrice({
      SenderStationId: sender.StationId,
      ReceiverStationId: receiver.StationId,
      SenderLocation: locationFor(req.origin),
      ReceiverLocation: locationFor(req.destination),
      CustomerCode: gigCustomerCode(),
      CustomerType: gigCustomerType(),
      PickUpOptions: 0,
      ShipmentItems: shipmentItems,
    }),
    fetchDropoffPrice({
      SenderStationId: sender.StationId,
      ReceiverStationId: receiver.StationId,
      DeliveryType: 0, // 0 = GOSTANDARDED (standard service, matches pickup)
      PickUpOptions: 0,
      ShipmentItems: shipmentItems,
    }),
  ])

  const grandOf = (r: PromiseSettledResult<GigPriceResult>): number =>
    r.status === 'fulfilled'
      ? Number(r.value.GrandTotal ?? r.value.DeliverPrice ?? 0)
      : 0
  const pickupGrand = grandOf(pickupRes)
  const dropoffGrand = grandOf(dropoffRes)
  if (pickupRes.status === 'rejected')
    logger.warn(`[gig] pickup price failed: ${String(pickupRes.reason)}`)
  if (dropoffRes.status === 'rejected')
    logger.warn(`[gig] dropoff price failed: ${String(dropoffRes.reason)}`)

  const grand = Math.max(pickupGrand, dropoffGrand)
  if (!grand) return null

  const zone = resolveZone(req.origin.state, req.destination.state)
  const eta = ZONE_ETA[zone]
  // GIG returns a single price for our ecommerce account (Discount: 0) — this IS
  // our cost. The buyer-facing markup is applied centrally by the orchestrator
  // (SHIPPING_MARKUP_PCT), so we no longer fabricate a "Basic" retail here.
  // InsuranceValue (1% of declared value) is part of GrandTotal — take it from
  // whichever leg set the (max) price so pricing passes it through at cost.
  const chosen = dropoffGrand >= pickupGrand ? dropoffRes : pickupRes
  const insMajor =
    chosen.status === 'fulfilled' ? Number(chosen.value.InsuranceValue ?? 0) : 0
  const costMinor = NGN(grand)
  const insuranceMinor = NGN(insMajor)

  return [
    {
      carrierId: 'gig',
      carrierName: 'GIG Logistics',
      serviceLevel: 'standard',
      zoneCode: zone,
      costMinor,
      insuranceMinor,
      listMinor: costMinor,
      buyerPriceMinor: costMinor, // orchestrator applies markup + discount dial
      currency: req.currency ?? 'NGN',
      etaText: eta.text,
      etaMinHours: eta.minHours,
      etaMaxHours: eta.maxHours,
      codEligible: true,
    },
  ]
}

function fallbackQuote(req: ShipmentRequest): Quote[] {
  const weight = totalWeightKg(req)
  const zone = resolveZone(req.origin.state, req.destination.state)
  const eta = ZONE_ETA[zone]
  // Offline estimate when the live API is down: use the Class rate card as cost;
  // the orchestrator applies the same central markup as the live path.
  const costMinor = NGN(gigRateNGN('CLASS', zone, weight))
  return [
    {
      carrierId: 'gig',
      carrierName: 'GIG Logistics',
      serviceLevel: 'standard',
      zoneCode: zone,
      costMinor,
      listMinor: costMinor,
      buyerPriceMinor: costMinor,
      currency: req.currency ?? 'NGN',
      etaText: eta.text,
      etaMinHours: eta.minHours,
      etaMaxHours: eta.maxHours,
      codEligible: true,
    },
  ]
}

export const gigProvider: IShippingProvider = {
  id: 'gig',
  name: 'GIG Logistics',
  capabilities: {
    cod: true,
    tracking: true,
    labelGeneration: true,
    insurance: true,
    international: false,
  },
  policy: gigPolicy,

  canHandle(req: ShipmentRequest): boolean {
    // Platform pause (see isGigEnabled). This is the registry-level gate — the
    // orchestrator filters on canHandle, so no caller can surface a GIG quote
    // while it's off. Necessary because `quote()` below falls back to the
    // static rate card when the API is unreachable: without this, a caller that
    // asked for GIG would still get priced options for a carrier we can't book.
    if (!isGigEnabled()) return false
    const domestic =
      req.origin.country?.toUpperCase() === 'NG' &&
      req.destination.country?.toUpperCase() === 'NG'
    return domestic && totalWeightKg(req) <= gigPolicy.maxWeightKg
  },

  async quote(req: ShipmentRequest): Promise<Quote[]> {
    if (isGigConfigured()) {
      try {
        const live = await liveQuote(req)
        if (live) return live
      } catch (err) {
        logger.warn(`[gig] live price failed, using rate card: ${String(err)}`)
      }
    }
    return fallbackQuote(req)
  },

  /**
   * Book a collection shipment. `/capture/preshipment` takes a NESTED body —
   * Sender/Receiver/Shipment details grouped, `ShipmentItems` at the top level.
   * A flat body is rejected with `"SenderName" is not allowed`. This exact shape
   * was accepted by the sandbox (returns a Waybill); do not flatten it.
   *
   * The Waybill exists the moment this returns, BEFORE GIG holds the parcel — the
   * only scan present is MCRT ("created by customer"). Callers must not treat a
   * successful booking as proof of handover; wait for a possession scan.
   */
  async book(req: BookRequest): Promise<ShipmentResult> {
    if (!isGigConfigured()) {
      throw createError({
        statusCode: 501,
        statusMessage: 'GIG not configured',
      })
    }
    const { origin, destination } = req.request
    const weight = totalWeightKg(req.request)
    const cod = req.settlementMode === 'CARRIER_COD'

    // /price resolves stations from state; booking must use the same pair, or the
    // booked shipment can be routed (and priced) differently from what we quoted.
    const [sender, receiver] = await Promise.all([
      resolveStation(origin.state),
      resolveStation(destination.state),
    ])
    if (!sender || !receiver) {
      throw createError({
        statusCode: 422,
        statusMessage: `GIG has no station for ${!sender ? origin.state : destination.state}`,
      })
    }

    const res = await capturePreshipment({
      SenderDetails: {
        SenderName: origin.name,
        SenderPhoneNumber: origin.phone || '',
        SenderStationId: sender.StationId,
        SenderAddress: origin.street1,
        InputtedSenderAddress: origin.street1,
        SenderLocality: origin.city,
        SenderLocation: locationFor(origin),
      },
      ReceiverDetails: {
        ReceiverName: destination.name,
        ReceiverPhoneNumber: destination.phone || '',
        ReceiverStationId: receiver.StationId,
        ReceiverAddress: destination.street1,
        InputtedReceiverAddress: destination.street1,
        ReceiverLocation: locationFor(destination),
      },
      ShipmentDetails: {
        VehicleType: 0,
        IsCashOnDelivery: cod,
        CashOnDeliveryAmount: cod
          ? (req.request.declaredValueMinor || 0) / 100
          : 0,
      },
      // Must mirror the quote's item shape (regular, weight-priced) so the booked
      // shipment matches the quoted price — see quote()'s note on ShipmentType.
      ShipmentItems: [
        {
          Quantity: 1,
          ShipmentType: 1,
          ItemName: 'Merchandise',
          IsVolumetric: false,
          Weight: weight,
          Value: (req.request.declaredValueMinor || 0) / 100,
        },
      ],
    })
    if (!res.Waybill) throw new Error('GIG capture returned no Waybill')
    return {
      carrierId: 'gig',
      trackingNumber: res.Waybill,
      costMinor: 0, // priced at quote time; capture does not re-return the amount
      buyerPriceMinor: 0,
      currency: req.request.currency ?? 'NGN',
      etaText: ZONE_ETA[resolveZone(origin.state, destination.state)].text,
    }
  },

  async track(trackingNumber: string): Promise<TrackingResult> {
    const data = await gigTrack(trackingNumber)
    const shipment = Array.isArray(data) ? data[0] : null
    const raw: any[] = shipment?.MobileShipmentTrackings ?? []
    const mapped: TrackingEvent[] = raw.map((e) => ({
      timestamp: e.DateTimeUtc || e.DateTime || new Date().toISOString(),
      status: mapStatus(e.Status),
      description: e.ScanStatusComment || e.ScanStatusReason || e.Status || '',
      location: e.Location || undefined,
    }))
    // GIG repeats scans (e.g. MCRT twice at creation) — collapse consecutive
    // duplicates so the buyer timeline shows each step once.
    const events: TrackingEvent[] = mapped.filter(
      (e, i) =>
        i === 0 ||
        e.status !== mapped[i - 1]!.status ||
        e.description !== mapped[i - 1]!.description,
    )
    const current = events.length ? events[events.length - 1]!.status : 'UNKNOWN'
    return {
      carrierId: 'gig',
      trackingNumber,
      currentStatus: current,
      events,
    }
  },

  parseWebhook(_payload: unknown): TrackingUpdate | null {
    return null // GIG tracking is pull-based (no webhook in the current API)
  },
}

export interface GigDropoffCentre {
  id: number
  name: string
  code: string
  address?: string
}

export interface GigDropoffResult {
  carrierId: 'gig'
  /**
   * GIG TempCode (e.g. "PRE000568-APH"). NOT a Waybill — it becomes one only once
   * the seller drops the parcel and GIG accepts it at the counter. Persist it, but
   * do not feed it to the Waybill-based tracking poller until the TempCode→Waybill
   * lifecycle is wired (needs the /track/mobileShipment behaviour for TempCodes).
   */
  tempCode: string
  /** The service centre the SELLER should physically drop the parcel at (nearest
   *  centre to the seller in their departure station) — shown in the seller UI. */
  dropoffCentre: GigDropoffCentre | null
  currency: string
  etaText: string
}

/**
 * Book a DROP-OFF shipment: the seller takes the parcel to a GIG service centre
 * themselves (fallback when GIG never comes to collect). Mirrors gigProvider.book()
 * but calls /create/dropOff and returns a TempCode instead of a Waybill.
 *
 * Deliberately NOT on IShippingProvider — drop-off is GIG-specific; callers invoke
 * it directly (as gig.pod does with book()). Fully self-contained: it resolves the
 * DestinationServiceCenterId that /create/dropOff requires from the receiver's
 * station (nearest centre to the buyer) via /serviceCentresByStation.
 */
export async function bookGigDropoff(
  req: BookRequest,
  chosenDropoffCentre?: GigDropoffCentre | null,
): Promise<GigDropoffResult> {
  if (!isGigConfigured()) {
    throw createError({ statusCode: 501, statusMessage: 'GIG not configured' })
  }
  const { origin, destination } = req.request
  const weight = totalWeightKg(req.request)
  const cod = req.settlementMode === 'CARRIER_COD'

  // Same station pair the quote used, so the booked shipment matches the price.
  const [sender, receiver] = await Promise.all([
    resolveStation(origin.state),
    resolveStation(destination.state),
  ])
  if (!sender || !receiver) {
    throw createError({
      statusCode: 422,
      statusMessage: `GIG has no station for ${!sender ? origin.state : destination.state}`,
    })
  }

  // Destination service centre nearest the buyer — required by /create/dropOff.
  const centre = await resolveServiceCentre(
    receiver.StationId,
    destination.lat,
    destination.lng,
  )
  if (!centre) {
    throw createError({
      statusCode: 422,
      statusMessage: `GIG has no service centre for ${destination.state}`,
    })
  }

  // The centre the SELLER physically drops at: their chosen one, else nearest.
  let dropCentre: GigDropoffCentre | null = chosenDropoffCentre ?? null
  if (!dropCentre) {
    const nearest = await resolveServiceCentre(
      sender.StationId,
      origin.lat,
      origin.lng,
    )
    dropCentre = nearest
      ? {
          id: nearest.ServiceCentreId,
          name: nearest.ServiceCentreName,
          code: nearest.ServiceCentreCode,
          address: nearest.Address,
        }
      : null
  }

  // NOTE: /create/dropOff uses `PickupOptions` (not `PickUpOptions` as on /price).
  const res = await captureDropoff({
    SenderDetails: {
      SenderName: origin.name,
      SenderPhoneNumber: origin.phone || '',
      SenderCity: origin.city,
      DepartureStationId: sender.StationId,
    },
    ReceiverDetails: {
      ReceiverName: destination.name,
      ReceiverPhoneNumber: destination.phone || '',
      ReceiverAddress: destination.street1,
      ReceiverCity: destination.city,
      DestinationStationId: receiver.StationId,
      DestinationServiceCenterId: centre.ServiceCentreId,
    },
    ShipmentDetails: {
      DeliveryType: 0, // GOSTANDARDED — matches the standard quote
      PickupOptions: 0, // 0 = HomeDelivery to the buyer's address
      IsCashOnDelivery: cod ? 1 : 0,
      CashOnDeliveryAmount: cod ? (req.request.declaredValueMinor || 0) / 100 : 0,
    },
    ShipmentItems: [
      {
        Quantity: 1,
        ShipmentType: 1,
        ItemName: 'Merchandise',
        IsVolumetric: false,
        Weight: weight,
        Value: (req.request.declaredValueMinor || 0) / 100,
      },
    ],
  })

  if (!res.TempCode) throw new Error('GIG dropOff returned no TempCode')
  return {
    carrierId: 'gig',
    tempCode: res.TempCode,
    dropoffCentre: dropCentre,
    currency: req.request.currency ?? 'NGN',
    etaText: ZONE_ETA[resolveZone(origin.state, destination.state)].text,
  }
}
