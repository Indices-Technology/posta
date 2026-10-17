import type { PostaUser } from '../types/user'
import { marketxLogin, marketxLogout, type Tokens } from '../utils/marketx'

export const authService = {
  /** Signs in through MarketX. Returns the tokens (for the route to set as cookies) and the public user. */
  async login(email: string, password: string, clientIp?: string): Promise<{ tokens: Tokens; user: PostaUser }> {
    const res = await marketxLogin(email, password, clientIp)
    const { id, username, role, phone } = res.user
    return {
      tokens: { accessToken: res.accessToken, refreshToken: res.refreshToken },
      user: { id, email: res.user.email, username, role, phone },
    }
  },

  logout(tokens: { accessToken?: string; refreshToken?: string }) {
    return marketxLogout(tokens.accessToken, tokens.refreshToken)
  },
}
