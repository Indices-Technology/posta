// GET /api/delivery/jobs/:token — PUBLIC. The link itself is the carrier's credential.
import { jobService } from '../../../services/job.service'

export default defineApiHandler((event) => jobService.view(getRouterParam(event, 'token')!))
