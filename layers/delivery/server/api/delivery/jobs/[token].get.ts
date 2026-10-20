// GET /api/delivery/jobs/:token — PUBLIC. A carrier's job: their two handovers. The link is the credential.
import { carrierService } from '../../../services/carrier.service'

export default defineApiHandler((event) => carrierService.job(getRouterParam(event, 'token')!))
