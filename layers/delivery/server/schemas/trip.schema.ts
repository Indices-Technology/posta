import { z } from 'zod'
import { cityField, nameField, phoneField } from '~~/layers/core/server/schemas/common.schema'

export const createTripSchema = z
  .object({
    driverName: nameField('your name'),
    driverPhone: phoneField('your'),
    fromCity: cityField('starting'),
    toCity: cityField('destination'),
    departAt: z.coerce.date({ invalid_type_error: 'Choose when you leave' }),
    arriveBy: z.coerce.date({ invalid_type_error: 'Choose when you arrive' }),
    capacity: z.coerce.number().int().min(1, 'Room for at least 1 parcel').max(20, 'At most 20 parcels per trip'),
  })
  .refine((t) => t.departAt > new Date(), { message: 'That time has passed', path: ['departAt'] })
  .refine((t) => t.arriveBy > t.departAt, { message: 'Arrival must be after you leave', path: ['arriveBy'] })
  .refine((t) => t.fromCity.toLowerCase() !== t.toCity.toLowerCase(), {
    message: 'Start and destination must differ',
    path: ['toCity'],
  })
export type CreateTripInput = z.infer<typeof createTripSchema>
