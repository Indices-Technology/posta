// GET /api/delivery/track/:token — PUBLIC. The recipient's tracking page (holds their delivery code).
import { parcelService } from '../../../services/parcel.service'

export default defineApiHandler((event) => parcelService.getTracking(getRouterParam(event, 'token')!))
