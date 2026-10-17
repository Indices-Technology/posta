// GET /api/delivery/parcels?number=1001 — my parcels in plain words (used by Axioms / Dasah).
import { z } from 'zod'
import { parcelService } from '../../../services/parcel.service'

const query = z.object({ number: z.coerce.number().int().positive().optional() })

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  const { number } = query.parse(getQuery(event))
  return parcelService.listForUser(user, number)
})
