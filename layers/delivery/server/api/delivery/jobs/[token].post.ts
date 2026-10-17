// POST /api/delivery/jobs/:token — PUBLIC. The carrier types the code they were given.
import { jobActionSchema } from '../../../schemas/job.schema'
import { jobService } from '../../../services/job.service'

export default defineApiHandler(async (event) =>
  jobService.act(getRouterParam(event, 'token')!, jobActionSchema.parse(await readBody(event))),
)
