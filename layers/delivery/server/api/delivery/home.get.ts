// GET /api/delivery/home — my parcels, my trips, cities with handover points, form prefill.
import { homeService } from '../../services/home.service'

export default defineApiHandler(async (event) => homeService.get(await requireUser(event)))
