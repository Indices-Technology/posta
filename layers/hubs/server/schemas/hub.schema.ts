import { z } from 'zod'
import { cityField, nameField, phoneField, postcodeField } from '~~/layers/core/server/schemas/common.schema'

const centreFields = {
  name: nameField('name of the centre'),
  postcode: postcodeField('centre'),
  city: cityField('centre'),
  address: z.string({ required_error: 'Enter the street address' }).trim().min(5, 'Enter the street address').max(160),
  openingHours: z.string().trim().max(60).default(''),
  lat: z.coerce
    .number({ invalid_type_error: 'Set the centre on the map' })
    .min(4, 'The location must be inside Nigeria')
    .max(14, 'The location must be inside Nigeria'),
  lng: z.coerce
    .number({ invalid_type_error: 'Set the centre on the map' })
    .min(2.5, 'The location must be inside Nigeria')
    .max(15, 'The location must be inside Nigeria'),
  contactPhone: phoneField("the centre's"),
}

/** Registering a centre (shop owners wait for approval; staff's go live at once). */
export const registerCentreSchema = z.object(centreFields)
export type RegisterCentreInput = z.infer<typeof registerCentreSchema>
