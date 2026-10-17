// GET /api/admin/overview — staff only: figures, what needs attention, every parcel.
import { adminService } from '../../services/admin.service'

export default defineApiHandler(async (event) => adminService.overview(await requireUser(event)))
