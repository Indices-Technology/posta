// GET /api/couriers/mine — my courier profiles (person and/or company) and their open jobs.
import { courierService } from '../../services/courier.service'

export default defineApiHandler(async (event) => courierService.mine(await requireUser(event)))
