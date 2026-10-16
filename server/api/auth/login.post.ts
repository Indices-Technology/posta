import { z } from 'zod'

const body = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, body.parse)
  const result = await marketxLogin(email, password, getRequestIP(event, { xForwardedFor: true }))
  setTokens(event, result)
  // Tokens stay in httpOnly cookies; the page only needs to know who signed in.
  const { id, username, role } = result.user
  return { user: { id, email: result.user.email, username, role } }
})
