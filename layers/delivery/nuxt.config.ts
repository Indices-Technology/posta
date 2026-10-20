// Delivery layer: parcels, the handover chain, carriers (couriers and travellers), scans, tracking.
export default defineNuxtConfig({
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: { '* * * * *': ['delivery:sweep'] },
  },
})
