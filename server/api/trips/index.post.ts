import { z } from 'zod'
import { runMatching } from '../../services/match.service'

const body = z
  .object({
    driverName: nameField("driver's name"),
    driverPhone: phoneField("the driver's"),
    fromCity: cityField('starting'),
    toCity: cityField('destination'),
    departAt: z.coerce.date({ invalid_type_error: 'Enter when the trip leaves' }),
    arriveBy: z.coerce.date({ invalid_type_error: 'Enter when the trip arrives' }),
    capacity: z.coerce.number().int().min(1, 'Room for at least 1 parcel').max(20, 'At most 20 parcels per trip'),
  })
  .refine((t) => t.departAt > new Date(), { message: 'The trip must leave in the future', path: ['departAt'] })
  .refine((t) => t.arriveBy > t.departAt, { message: 'Arrival must be after departure', path: ['arriveBy'] })
  .refine((t) => t.fromCity.toLowerCase() !== t.toCity.toLowerCase(), { message: 'Start and destination must differ', path: ['toCity'] })

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await parseBody(event, body)
  const trip = await prisma.trip.create({ data: { ...input, createdBy: user.id } })

  const legs = await runMatching().catch((err) => {
    console.error('[match] after trip create', err)
    return []
  })
  return { id: trip.id, matched: legs.filter((l) => l.tripId === trip.id).length }
})
