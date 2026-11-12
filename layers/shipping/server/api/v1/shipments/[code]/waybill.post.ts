// POST /api/v1/shipments/:code/waybill { waybill }: a drop-off was handed in; tracking starts.
import { requireClient } from '../../../../utils/apiKey'
import { waybillSchema } from '../../../../schemas/shipment.schema'
import { shipmentService } from '../../../../services/shipment.service'

export default defineApiHandler(async (event) => {
  const client = requireClient(event)
  const { waybill } = waybillSchema.parse(await readBody(event))
  return shipmentService.setWaybill(client, getRouterParam(event, 'code')!, waybill)
})
