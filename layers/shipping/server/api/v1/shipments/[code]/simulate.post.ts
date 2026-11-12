// POST /api/v1/shipments/:code/simulate { status }: staging only (POSTA_ALLOW_SIMULATE=true).
// Takes the exact path a real carrier scan takes, webhook included.
import { requireClient } from '../../../../utils/apiKey'
import { simulateSchema } from '../../../../schemas/shipment.schema'
import { shipmentService } from '../../../../services/shipment.service'

export default defineApiHandler(async (event) => {
  const client = requireClient(event)
  const { status } = simulateSchema.parse(await readBody(event))
  return shipmentService.simulate(client, getRouterParam(event, 'code')!, status)
})
