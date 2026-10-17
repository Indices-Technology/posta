/**
 * Posta's public address, for links sent outside the app (WhatsApp, webhooks).
 * Reads the env directly (not useRuntimeConfig) so scripts and tasks can use it too.
 */
export const siteUrl = () => (process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3100').replace(/\/$/, '')
