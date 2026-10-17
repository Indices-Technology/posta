/**
 * Auth store: who is signed in. State only, no API calls (useAuth does those), as in MarketX.
 * Filled during server render by plugins/auth.server.ts; Pinia carries it to the browser.
 */
import type { PostaUser } from '../types/user'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<PostaUser | null>(null)

  const isSignedIn = computed(() => !!user.value)
  const isOps = computed(() => user.value?.role === 'admin' || user.value?.role === 'support_agent')
  const displayName = computed(() => user.value?.username || user.value?.email || '')

  const setUser = (u: PostaUser | null) => {
    user.value = u
  }

  return { user, isSignedIn, isOps, displayName, setUser }
})
