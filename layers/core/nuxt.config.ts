import { fileURLToPath } from 'node:url'

// Core layer: sign-in (through MarketX), the API client, errors, layout and the design system.
// Every other layer builds on this one. See docs/ARCHITECTURE.md.
export default defineNuxtConfig({
  css: [fileURLToPath(new URL('./app/assets/css/main.css', import.meta.url))],
})
