// Shipping layer: carriers (GIG, the seller's own delivery, Posta's network) and the /api/v1 API
// that clients such as MarketX use for delivery. See docs/SHIPPING_MOVE.md.
export default defineNuxtConfig({
  runtimeConfig: {
    // "name:<sha256 hex>" per client, comma-separated (server/utils/apiKey.ts). NUXT_API_KEYS
    apiKeys: '',
    // Offer Posta's own network in quotes. Off until the rate card in carriers/posta.ts is real. NUXT_NETWORK_QUOTES
    networkQuotes: false,
  },
})
