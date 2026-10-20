// GET /api/couriers/near?lat=&lng= — available couriers a sender can pick for a pickup.
import { z } from 'zod'
import { courierService } from '../../services/courier.service'

const query = z.object({ lat: z.coerce.number().min(4).max(14), lng: z.coerce.number().min(2.5).max(15) })

export default defineApiHandler(async (event) => {
  await requireUser(event)
  const { lat, lng } = query.parse(getQuery(event))
  return courierService.near(lat, lng)
})
