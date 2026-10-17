/**
 * Field rules shared by every form. Messages are written for the person filling the form,
 * because defineApiHandler shows the first one as-is.
 */
import { z } from 'zod'

export const nameField = (what: string) =>
  z.string({ required_error: `Enter the ${what}` }).trim().min(2, `Enter the ${what}`).max(80)

export const phoneField = (whose: string) =>
  z
    .string({ required_error: `Enter ${whose} phone number` })
    .trim()
    .regex(/^\+?\d[\d\s]{9,15}$/, `Enter ${whose} phone number, like 0803 000 0000`)

/** National postcode, stored in its dashed form (shared/utils/postcode.ts). */
export const postcodeField = (what: string) =>
  z.string({ required_error: `Enter the ${what} postcode` }).transform((s, ctx) => {
    const code = normalizePostcode(s)
    if (!code) ctx.addIssue({ code: 'custom', message: `Enter the ${what} postcode in the national format, like FC-01-A01-KP-27` })
    return code ?? ''
  })

export const cityField = (what: string) =>
  z.string({ required_error: `Choose the ${what} city` }).trim().min(2, `Choose the ${what} city`).max(40)

/** Staff deciding an application (courier, courier company, fulfilment centre). */
export const reviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED'], { errorMap: () => ({ message: 'Choose approve or reject' }) }),
})
export type ReviewInput = z.infer<typeof reviewSchema>
