// GET /api/centres/dashboard — the centres I run: parcels coming in and on my shelf.
import { centreService } from '../../services/centre.service'

export default defineApiHandler(async (event) => centreService.dashboard(await requireUser(event)))
