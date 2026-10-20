// POST /api/couriers/offers/:id/decline — pass; the job goes to the next courier.
import { dispatchService } from '~~/layers/delivery/server/services/dispatch.service'

export default defineApiHandler(async (event) => dispatchService.decline(getRouterParam(event, 'id')!, await requireUser(event)))
