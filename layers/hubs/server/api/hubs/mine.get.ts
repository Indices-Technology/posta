// GET /api/hubs/mine — the centres I registered, with their status.
import { hubService } from '../../services/hub.service'

export default defineApiHandler(async (event) => hubService.mine(await requireUser(event)))
