// POST /api/couriers/offers/:id/accept — take the job.
import { dispatchService } from '~~/layers/delivery/server/services/dispatch.service'

export default defineApiHandler(async (event) => dispatchService.accept(getRouterParam(event, 'id')!, await requireUser(event)))
