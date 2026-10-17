// POST /api/hubs/:id/review — staff approve or reject a centre application.
import { reviewSchema } from '~~/layers/core/server/schemas/common.schema'
import { hubService } from '../../../services/hub.service'

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  return hubService.review(user, getRouterParam(event, 'id')!, reviewSchema.parse(await readBody(event)))
})
