// Notifications layer: in-app inbox, WhatsApp, and signed webhooks to courier companies.
// Every message is a Notification row first; the scheduled task below retries anything unsent.
export default defineNuxtConfig({
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: { '* * * * *': ['notifications:flush'] },
  },
})
