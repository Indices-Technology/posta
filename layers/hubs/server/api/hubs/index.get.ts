// GET /api/hubs — every handover point; canEdit tells the page whether to offer "Add".
import { hubService } from '../../services/hub.service'

export default defineApiHandler(async (event) => hubService.list(await requireUser(event)))
