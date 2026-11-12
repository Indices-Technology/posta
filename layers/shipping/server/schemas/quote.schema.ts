import { z } from 'zod'

export const address = z.object({
  name: z.string().max(120).default(''),
  street1: z.string().max(200).default(''),
  city: z.string().max(80).default(''),
  state: z.string({ required_error: 'state is required' }).trim().min(2, 'state is required').max(80),
  country: z.string().length(2).toUpperCase().default('NG'),
  phone: z.string().max(30).optional(),
  /** National postcode (FC-01-A01-KP-27), when the client has one. */
  zip: z.string().max(20).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

export const kobo = z.number().int().min(0)

/** The seller's own delivery terms, resolved by the client (Posta never sees the seller). */
const sellerShipping = z.object({
  selfEnabled: z.boolean(),
  flatRateMinor: kobo.optional(),
  freeOverMinor: kobo.optional(),
  pickupEnabled: z.boolean().optional(),
  pickupNote: z.string().max(200).optional(),
  payDriverEnabled: z.boolean().optional(),
  etaText: z.string().max(80).optional(),
  zoneRates: z.record(z.enum(['Z1', 'Z2', 'Z3', 'Z4']), kobo).optional(),
})

export const CARRIERS = ['self', 'gig', 'posta'] as const

export const quoteSchema = z.object({
  origin: address,
  destination: address,
  parcel: z.object({ weightKg: z.number().positive().max(200) }),
  /** Declared value for insurance; 0 means uninsured. */
  declaredValueMinor: kobo.default(0),
  /** Order subtotal, for the seller's free-delivery threshold. */
  subtotalMinor: kobo.default(0),
  /** door: delivered to the address. collect: picked up (from the seller or a centre). Omit for both. */
  mode: z.enum(['door', 'collect']).optional(),
  /** Which carriers this client may use for this shipment. Omit for all. */
  carriers: z.array(z.enum(CARRIERS)).min(1).optional(),
  sellerShipping: sellerShipping.optional(),
  strategy: z.enum(['best-value', 'cheapest', 'fastest', 'safest']).default('best-value'),
})

export type QuoteInput = z.infer<typeof quoteSchema>
