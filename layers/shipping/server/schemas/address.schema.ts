import { z } from 'zod'

/** Anything a person might give us for where they are. At least one is needed. */
export const resolveSchema = z
  .object({
    postcode: z.string().trim().max(20).optional(),
    lat: z.number().min(4).max(14).optional(),
    lng: z.number().min(2.5).max(15).optional(),
    mapLink: z.string().trim().url().max(1000).optional(),
    address: z.string().trim().max(200).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(40).optional(),
  })
  .refine((v) => (v.lat == null) === (v.lng == null), { message: 'Send lat and lng together', path: ['lat'] })
  .refine((v) => v.postcode || v.lat != null || v.mapLink || v.address, {
    message: 'Send a postcode, a map point, a map link or an address',
    path: ['address'],
  })

export type ResolveInput = z.infer<typeof resolveSchema>
