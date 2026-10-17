// Posta is split into domain layers, the same way MarketX is (see docs/ARCHITECTURE.md).
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  // marketX dev owns 3000. If Posta took it, Posta would call its own login in a loop.
  devServer: { port: 3100 },

  extends: [
    './layers/core',
    './layers/notifications',
    './layers/delivery',
    './layers/couriers',
    './layers/hubs',
    './layers/admin',
  ],

  modules: ['@pinia/nuxt', '@nuxt/icon'],
  // Icons ship with the app (no calls to the Iconify API). Same Solar set as MarketX.
  icon: { serverBundle: { collections: ['solar'] }, clientBundle: { scan: true } },

  runtimeConfig: {
    // Posta has no accounts of its own: people sign in with their MarketX account.
    marketxApiUrl: 'https://marketx.africa', // NUXT_MARKETX_API_URL
    // Secret key from the postcode.gov.ng dashboard (Settings → API Keys). Server only.
    postcodeApiKey: '', // NUXT_POSTCODE_API_KEY
  },

  app: {
    head: {
      title: 'Posta',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#faf8f5' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..900&family=Manrope:wght@500;600;700;800&display=swap',
        },
      ],
    },
  },
})
