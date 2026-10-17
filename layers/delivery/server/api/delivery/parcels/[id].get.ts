// GET /api/delivery/parcels/:id — the parcel page (owner or staff).
import { parcelService } from '../../../services/parcel.service'

export default defineApiHandler(async (event) =>
  parcelService.getForUser(await requireUser(event), getRouterParam(event, 'id')!),
)
