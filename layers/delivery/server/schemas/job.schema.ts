import { z } from 'zod'

export const jobActionSchema = z.object({
  action: z.enum(['collect', 'handover']),
  code: z.string({ required_error: 'Enter the 6-digit code' }).trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})
export type JobActionInput = z.infer<typeof jobActionSchema>
