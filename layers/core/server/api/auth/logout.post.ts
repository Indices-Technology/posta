// POST /api/auth/logout — ends the MarketX session too, not just Posta's cookies.
import { authService } from '../../services/auth.service'

export default defineApiHandler(async (event) => {
  await authService.logout(readTokens(event))
  clearTokens(event)
  return null
})
