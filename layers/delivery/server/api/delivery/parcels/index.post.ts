// POST /api/delivery/parcels — book a parcel. Matching runs straight away.
import { createParcelSchema } from '../../../schemas/parcel.schema'
import { parcelService } from '../../../services/parcel.service'

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  return parcelService.create(user, createParcelSchema.parse(await readBody(event)))
})
