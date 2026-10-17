// POST /api/couriers/:id/review — staff approve or reject. Approval assigns parcels waiting in that city.
import { reviewSchema } from '~~/layers/core/server/schemas/common.schema'
import { courierService } from '../../../services/courier.service'

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  return courierService.review(user, getRouterParam(event, 'id')!, reviewSchema.parse(await readBody(event)))
})
