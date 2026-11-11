// POST /api/v1/quotes — ranked delivery options for one parcel. Server-to-server, x-posta-key.
// Contract: docs/INTEGRATIONS.md §5.
import { requireClient } from '../../utils/apiKey'
import { quoteSchema } from '../../schemas/quote.schema'
import { quoteService } from '../../services/quote.service'

export default defineApiHandler(async (event) => {
  const client = requireClient(event)
  rateLimit(`client:${client}`, 600, 60_000)
  return quoteService.quote(quoteSchema.parse(await readBody(event)))
})
