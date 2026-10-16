import { z } from 'zod'
import { runMatching } from '../../services/match.service'

const body = z.object({
  senderName: nameField("sender's name"),
  senderPhone: phoneField("the sender's"),
  pickupPostcode: postcodeField('pickup'),
  fromCity: cityField('pickup'),
  recipientName: nameField("recipient's name"),
  recipientPhone: phoneField("the recipient's"),
  dropPostcode: postcodeField('delivery'),
  toCity: cityField('delivery'),
  description: z.string().trim().min(2, "Say what's in the parcel").max(140),
  weightKg: z.coerce.number({ invalid_type_error: 'Enter the weight in kg' }).positive('Enter the weight in kg').max(30, 'Posta carries parcels up to 30 kg'),
  // Declared value cap from the plan: limits what a single carrier is trusted with.
  valueNaira: z.coerce.number({ invalid_type_error: 'Enter the value in naira' }).int().min(0).max(500_000, 'Parcels worth more than ₦500,000 are not accepted yet'),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { valueNaira, ...input } = await parseBody(event, body)
  await assertPostcodesExist({ pickupPostcode: input.pickupPostcode, dropPostcode: input.dropPostcode })

  const parcel = await prisma.parcel.create({
    data: { ...input, valueKobo: valueNaira * 100, createdBy: user.id },
  })
  await prisma.event.create({ data: { parcelId: parcel.id, type: 'parcel.created' } })

  // Matching failing must not lose the parcel; it stays waiting and the next trip or parcel retries.
  await runMatching().catch((err) => console.error('[match] after parcel create', err))
  return { id: parcel.id }
})
