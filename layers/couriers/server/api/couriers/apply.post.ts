// POST /api/couriers/apply — apply as a courier, or register a courier company (needs approval).
import { applyCourierSchema } from '../../schemas/courier.schema'
import { courierService } from '../../services/courier.service'

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  return courierService.apply(user, applyCourierSchema.parse(await readBody(event)))
})
