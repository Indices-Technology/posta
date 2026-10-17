// POST /api/delivery/trips — post a trip; the poster is the driver. Matching runs straight away.
import { createTripSchema } from '../../../schemas/trip.schema'
import { tripService } from '../../../services/trip.service'

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  return tripService.create(user, createTripSchema.parse(await readBody(event)))
})
