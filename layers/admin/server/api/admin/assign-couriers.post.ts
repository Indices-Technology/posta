// POST /api/admin/assign-couriers — staff: retry courier assignment for parcels waiting at centres.
import { adminService } from '../../services/admin.service'

export default defineApiHandler(async (event) => adminService.assignCouriers(await requireUser(event)))
