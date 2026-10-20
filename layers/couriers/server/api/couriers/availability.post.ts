// POST /api/couriers/availability — the "I'm available" switch, with where the phone is now.
import { z } from 'zod'
import { courierService } from '../../services/courier.service'

const body = z.object({
  on: z.boolean(),
  lat: z.coerce.number().min(4).max(14).optional().nullable(),
  lng: z.coerce.number().min(2.5).max(15).optional().nullable(),
})

export default defineApiHandler(async (event) => courierService.setAvailability(await requireUser(event), body.parse(await readBody(event))))
