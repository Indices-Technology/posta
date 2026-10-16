// Every page needs a MarketX sign-in unless it says `definePageMeta({ public: true })`
// (login now; driver leg links and customer tracking pages later).
export default defineNuxtRouteMiddleware((to) => {
  if (to.meta.public) return
  if (!useUser().value) return navigateTo({ path: '/login', query: { next: to.fullPath } })
})
