// GET /api/v1/shipments/:code: where a shipment is now (the client's own shipments only).
import { requireClient } from '../../../../utils/apiKey'
import { shipmentService } from '../../../../services/shipment.service'

export default defineApiHandler(async (event) => {
  const client = requireClient(event)
  rateLimit(`client:${client}:read`, 600, 60_000)
  return shipmentService.get(client, getRouterParam(event, 'code')!)
})
