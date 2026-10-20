/**
 * Go back to where the person came from inside Posta. Someone who arrived from outside (a WhatsApp
 * link, a fresh tab) has no Posta page behind them, so they go to `fallback` instead of leaving the site.
 */
export const useBack = () => {
  const router = useRouter()
  return (fallback = '/') => (import.meta.client && window.history.state?.back ? router.back() : navigateTo(fallback))
}
