import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string({ required_error: 'Enter your email' }).trim().email('Enter a valid email'),
  password: z.string({ required_error: 'Enter your password' }).min(1, 'Enter your password'),
})
