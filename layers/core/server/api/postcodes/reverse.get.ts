// GET /api/postcodes/reverse?lat=6.5095&lng=3.3711 — the postcode at a map point (signed-in people).
// Calls NIPOST from our server so the API key never reaches a browser.
import { reverseQuerySchema } from '../../schemas/postcode.schema'
import { postcodeService } from '../../services/postcode.service'

export default defineApiHandler(async (event) => {
  await requireUser(event)
  return postcodeService.fromPoint(reverseQuerySchema.parse(getQuery(event)))
})
