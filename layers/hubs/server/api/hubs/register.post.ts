// POST /api/hubs/register — a shop owner registers their shop as a fulfilment centre (needs approval).
import { registerCentreSchema } from '../../schemas/hub.schema'
import { hubService } from '../../services/hub.service'

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  return hubService.register(user, registerCentreSchema.parse(await readBody(event)))
})
