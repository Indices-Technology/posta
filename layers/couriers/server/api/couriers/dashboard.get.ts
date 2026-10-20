// GET /api/couriers/dashboard — my availability, offers to answer, jobs in progress.
import { courierService } from '../../services/courier.service'

export default defineApiHandler(async (event) => courierService.dashboard(await requireUser(event)))
