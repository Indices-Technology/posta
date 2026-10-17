import { useAuthStore } from '../stores/auth.store'

// Every page needs a MarketX sign-in unless it says `definePageMeta({ public: true })`
// (login, carrier job links, recipient tracking links).
export default defineNuxtRouteMiddleware((to) => {
  if (to.meta.public) return
  if (!useAuthStore().isSignedIn) return navigateTo({ path: '/login', query: { next: to.fullPath } })
})
