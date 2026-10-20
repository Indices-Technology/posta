// GET /api/places/search?q=yaba&lat=&lng= — places (OpenStreetMap) or national postcodes (NIPOST).
import { z } from 'zod'
import { placeService } from '../../services/place.service'

const query = z.object({
  q: z.string().trim().min(2).max(80),
  lat: z.coerce.number().min(4).max(14).optional(),
  lng: z.coerce.number().min(2.5).max(15).optional(),
})

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  rateLimit(`search:${user.id}`, 60, 60_000)
  return placeService.search(query.parse(getQuery(event)))
})
