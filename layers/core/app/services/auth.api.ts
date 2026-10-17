import { BaseApiClient } from './base.api'
import type { PostaUser } from '../types/user'

export class AuthApiClient extends BaseApiClient {
  login(email: string, password: string) {
    return this.request<PostaUser>('/api/auth/login', { method: 'POST', body: { email, password } })
  }
  logout() {
    return this.request<null>('/api/auth/logout', { method: 'POST' })
  }
  me() {
    return this.request<PostaUser | null>('/api/auth/me')
  }
}
