// GET /api/handovers/:token?job= — what someone sees after scanning a handover QR.
// Public: carriers may hold only a job link. Says whether THIS viewer may confirm it.
import { handoverService } from '../../services/handover.service'

export default defineApiHandler(async (event) => {
  const job = getQuery(event).job
  return handoverService.view(getRouterParam(event, 'token')!, { user: await getUser(event), job: typeof job === 'string' ? job : null })
})
