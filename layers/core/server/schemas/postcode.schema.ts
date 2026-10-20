import { z } from 'zod'

// A point on the map, kept inside Nigeria (same box as the map's bounds).
export const reverseQuerySchema = z.object({
  lat: z.coerce.number({ invalid_type_error: 'Tap the map' }).min(4, 'Pick a place in Nigeria').max(14, 'Pick a place in Nigeria'),
  lng: z.coerce.number({ invalid_type_error: 'Tap the map' }).min(2.5, 'Pick a place in Nigeria').max(15, 'Pick a place in Nigeria'),
})
export type ReverseQuery = z.infer<typeof reverseQuerySchema>
