import { z } from 'zod'

const body = z.object({
  name: nameField('name of the place'),
  postcode: postcodeField('handover point'),
  city: cityField('handover point'),
  lat: z.coerce.number({ invalid_type_error: 'Enter the latitude' }).min(4, 'Latitude must be inside Nigeria').max(14, 'Latitude must be inside Nigeria'),
  lng: z.coerce.number({ invalid_type_error: 'Enter the longitude' }).min(2.5, 'Longitude must be inside Nigeria').max(15, 'Longitude must be inside Nigeria'),
  contactPhone: phoneField("the place's"),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requireOps(user)
  const input = await parseBody(event, body)
  await assertPostcodesExist({ postcode: input.postcode })
  const hub = await prisma.handoverPoint.create({ data: input })
  return { id: hub.id }
})
