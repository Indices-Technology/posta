// POST /api/v1/shipments: book the carrier for a paid order. Safe to repeat with the same clientRef.
// Contract in docs/INTEGRATIONS.md §7.
import { requireClient } from '../../../utils/apiKey'
import { bookSchema } from '../../../schemas/shipment.schema'
import { shipmentService } from '../../../services/shipment.service'

export default defineApiHandler(async (event) => {
  const client = requireClient(event)
  rateLimit(`client:${client}:book`, 120, 60_000)
  return shipmentService.book(client, bookSchema.parse(await readBody(event)))
})
