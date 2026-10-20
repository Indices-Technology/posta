import { z } from 'zod'
import { cityField, nameField, phoneField, postcodeField } from '~~/layers/core/server/schemas/common.schema'

const lat = z.coerce.number().min(4).max(14).optional().nullable()
const lng = z.coerce.number().min(2.5).max(15).optional().nullable()

export const createParcelSchema = z
  .object({
    senderName: nameField('your name'),
    senderPhone: phoneField('your'),
    recipientName: nameField("recipient's name"),
    recipientPhone: phoneField("the recipient's"),
    description: z.string({ required_error: "Say what's in the parcel" }).trim().min(2, "Say what's in the parcel").max(140),
    weightKg: z.coerce.number({ invalid_type_error: 'Choose a size' }).positive('Choose a size').max(30, 'Posta carries parcels up to 30 kg'),
    // Declared value cap: limits what a single carrier is trusted with.
    valueNaira: z.coerce
      .number({ invalid_type_error: 'Enter the value in naira' })
      .int()
      .min(0)
      .max(500_000, 'Parcels worth more than ₦500,000 are not accepted yet'),

    // Where it is now, and how it reaches the first centre.
    pickupPostcode: postcodeField('pickup'),
    pickupLat: lat,
    pickupLng: lng,
    firstMile: z.enum(['DROP_OFF', 'PICKUP'], { errorMap: () => ({ message: 'Choose drop-off or pickup' }) }),
    originHubId: z.string().min(1).optional().nullable(),
    preferredCourierId: z.string().min(1).optional().nullable(),

    // Where it is going, and how it reaches the recipient.
    dropPostcode: postcodeField('delivery'),
    dropLat: lat,
    dropLng: lng,
    lastMile: z.enum(['DOOR', 'COLLECT'], { errorMap: () => ({ message: 'Choose door delivery or collection' }) }),
    destHubId: z.string().min(1).optional().nullable(),
    // Only needed when the delivery point has no map pin (a typed postcode).
    toCity: cityField('delivery').optional(),
  })
  .refine((p) => p.firstMile !== 'DROP_OFF' || !!p.originHubId, { message: 'Choose the centre you will drop it at', path: ['originHubId'] })
  .refine((p) => p.firstMile !== 'PICKUP' || (p.pickupLat != null && p.pickupLng != null), {
    message: 'Mark the pickup on the map so a courier can find it',
    path: ['pickupLat'],
  })
  .refine((p) => p.lastMile !== 'COLLECT' || !!p.destHubId, { message: 'Choose the centre they will collect from', path: ['destHubId'] })
  .refine((p) => p.lastMile !== 'DOOR' || (p.dropLat != null && p.dropLng != null) || !!p.toCity, {
    message: 'Mark the delivery on the map',
    path: ['dropLat'],
  })
export type CreateParcelInput = z.infer<typeof createParcelSchema>
