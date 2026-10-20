import { z } from 'zod'
import { cityField, nameField, phoneField, postcodeField } from '~~/layers/core/server/schemas/common.schema'

export const createParcelSchema = z.object({
  senderName: nameField('your name'),
  senderPhone: phoneField('your'),
  pickupPostcode: postcodeField('pickup'),
  fromCity: cityField('pickup'),
  pickupLat: z.coerce.number().min(4).max(14).optional().nullable(),
  pickupLng: z.coerce.number().min(2.5).max(15).optional().nullable(),
  recipientName: nameField("recipient's name"),
  recipientPhone: phoneField("the recipient's"),
  dropPostcode: postcodeField('delivery'),
  toCity: cityField('delivery'),
  // The delivery pin from the map: matching hands the parcel to the nearest fulfilment centre.
  dropLat: z.coerce.number().min(4).max(14).optional().nullable(),
  dropLng: z.coerce.number().min(2.5).max(15).optional().nullable(),
  description: z.string({ required_error: "Say what's in the parcel" }).trim().min(2, "Say what's in the parcel").max(140),
  weightKg: z.coerce
    .number({ invalid_type_error: 'Choose a size' })
    .positive('Choose a size')
    .max(30, 'Posta carries parcels up to 30 kg'),
  // Declared value cap: limits what a single carrier is trusted with.
  valueNaira: z.coerce
    .number({ invalid_type_error: 'Enter the value in naira' })
    .int()
    .min(0)
    .max(500_000, 'Parcels worth more than ₦500,000 are not accepted yet'),
})
export type CreateParcelInput = z.infer<typeof createParcelSchema>
