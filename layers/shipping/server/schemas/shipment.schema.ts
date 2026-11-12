import { z } from 'zod'
import { address, kobo } from './quote.schema'

/** Who to deliver to and from: a name and phone are required, the rider calls them. */
const party = address.extend({
  name: z.string().trim().min(1, 'name is required').max(120),
  street1: z.string().trim().min(1, 'street1 is required').max(200),
  phone: z.string().trim().min(7, 'phone is required').max(30),
})

export const bookSchema = z.object({
  /** The client's own id (MarketX: order id). Booking twice with it returns the same shipment. */
  clientRef: z.string().trim().min(1).max(64),
  /** Only carriers Posta can book today. */
  carrierId: z.enum(['gig']),
  /** pickup: the carrier collects. dropoff: the sender takes it to a centre (GIG returns a counter code). */
  mode: z.enum(['pickup', 'dropoff']).default('pickup'),
  /** dropoff only: the GIG centre the sender chose; omit for the nearest one. */
  dropoffCentreId: z.number().int().positive().optional(),
  origin: party,
  destination: party,
  parcel: z.object({ weightKg: z.number().positive().max(200) }),
  declaredValueMinor: kobo,
  /** ESCROW_POD: paid online. CARRIER_COD: the carrier collects cash on delivery. */
  settlementMode: z.enum(['ESCROW_POD', 'CARRIER_COD']),
})
export type BookInput = z.infer<typeof bookSchema>

export const waybillSchema = z.object({ waybill: z.string().trim().min(3).max(40) })

export const TRACKING_STATUSES = ['PRE_TRANSIT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'FAILURE'] as const
export const simulateSchema = z.object({ status: z.enum(TRACKING_STATUSES) })
