// POST /api/auth/login — sign in with a MarketX account. Tokens go into httpOnly cookies, never the body.
import { loginSchema } from '../../schemas/auth.schema'
import { authService } from '../../services/auth.service'

export default defineApiHandler(async (event) => {
  const { email, password } = loginSchema.parse(await readBody(event))
  const { tokens, user } = await authService.login(email, password, getRequestIP(event, { xForwardedFor: true }))
  setTokens(event, tokens)
  return user
})
