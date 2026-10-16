import { z } from 'zod'

export const nameField = (what: string) =>
  z.string({ required_error: `Enter the ${what}` }).trim().min(2, `Enter the ${what}`).max(80)

export const phoneField = (whose: string) =>
  z
    .string({ required_error: `Enter ${whose} phone number` })
    .trim()
    .regex(/^\+?\d[\d\s]{9,15}$/, `Enter ${whose} phone number, like 0803 000 0000`)

export const postcodeField = (what: string) =>
  z
    .string({ required_error: `Enter the ${what} postcode` })
    .transform((s, ctx) => {
      const code = normalizePostcode(s)
      if (!code) ctx.addIssue({ code: 'custom', message: `Enter the ${what} postcode in the national format, like FC-01-A01-KP-27` })
      return code ?? ''
    })

export const cityField = (what: string) =>
  z.string({ required_error: `Choose the ${what} city` }).trim().min(2, `Choose the ${what} city`).max(40)
