import { useAuthStore } from '../stores/auth.store'

// The server middleware (01.session) already worked out who is signed in for this page load.
// Put it in the store; Pinia sends the store to the browser with the page.
export default defineNuxtPlugin(() => {
  useAuthStore().setUser(useRequestEvent()?.context.user ?? null)
})
