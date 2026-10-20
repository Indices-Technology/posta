// GET /api/hubs/near?lat=&lng= — approved centres nearest a point (drop-off and collection choices).
import { z } from 'zod'
import { centresNear } from '~~/layers/delivery/server/services/booking.service'

const query = z.object({ lat: z.coerce.number().min(4).max(14), lng: z.coerce.number().min(2.5).max(15) })

export default defineApiHandler(async (event) => {
  await requireUser(event)
  const { lat, lng } = query.parse(getQuery(event))
  const hubs = await centresNear(lat, lng, { limit: 5 })
  return hubs.map((h) => ({
    id: h.id,
    name: h.name,
    city: h.city,
    postcode: h.postcode,
    address: h.address,
    hours: h.openingHours,
    distanceKm: Math.round(h.distanceKm * 10) / 10,
  }))
})
