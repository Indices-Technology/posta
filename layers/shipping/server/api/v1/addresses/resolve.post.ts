// POST /api/v1/addresses/resolve: postcode, GPS point, map link or typed address → national postcode.
// Clients only (x-posta-key). Nothing is stored. Contract in docs/INTEGRATIONS.md §6.
import { requireClient } from '../../../utils/apiKey'
import { resolveSchema } from '../../../schemas/address.schema'
import { addressService } from '../../../services/address.service'

export default defineApiHandler(async (event) => {
  const client = requireClient(event)
  rateLimit(`client:${client}:addresses`, 300, 60_000)
  return addressService.resolve(resolveSchema.parse(await readBody(event)))
})
