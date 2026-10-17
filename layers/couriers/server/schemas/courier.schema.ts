import { z } from 'zod'
import { cityField, nameField, phoneField } from '~~/layers/core/server/schemas/common.schema'
import { isPublicHttpsUrl } from '../utils/publicUrl'

export const VEHICLES = ['BIKE', 'CAR', 'VAN'] as const

export const applyCourierSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('INDIVIDUAL'),
    name: nameField('your name'),
    phone: phoneField('your'),
    city: cityField('working'),
    vehicle: z.enum(VEHICLES, { errorMap: () => ({ message: 'Choose your vehicle' }) }),
  }),
  z.object({
    kind: z.literal('COMPANY'),
    name: nameField("company's name"),
    phone: phoneField("the company's"),
    city: cityField('working'),
    // Optional: without it, the company's riders get jobs on WhatsApp like anyone else.
    webhookUrl: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || undefined)
      .refine((v) => v === undefined || isPublicHttpsUrl(v), { message: 'Enter a public https:// address' }),
  }),
])
export type ApplyCourierInput = z.infer<typeof applyCourierSchema>

