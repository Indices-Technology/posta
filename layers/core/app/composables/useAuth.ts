import { AuthApiClient } from '../services/auth.api'
import { useAuthStore } from '../stores/auth.store'

/** Sign in and out. Pages use this, never the API client or the store's setters directly. */
export function useAuth() {
  const store = useAuthStore()
  const api = new AuthApiClient()

  async function login(email: string, password: string) {
    store.setUser(await api.login(email, password))
  }

  async function logout() {
    await api.logout()
    store.setUser(null)
    await navigateTo('/login')
  }

  return { user: computed(() => store.user), isOps: computed(() => store.isOps), displayName: computed(() => store.displayName), login, logout }
}
