// GET /api/delivery/trips/:id — the driver's view of their trip (owner or staff).
import { tripService } from '../../../services/trip.service'

export default defineApiHandler(async (event) =>
  tripService.getForUser(await requireUser(event), getRouterParam(event, 'id')!),
)
