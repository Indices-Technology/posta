// Resolve the user on page loads, so a refreshed token is set on the page response itself
// and the page renders already signed in. API routes call getUser/requireUser themselves.
export default defineEventHandler(async (event) => {
  const path = event.path
  if (path.startsWith('/api/') || path.startsWith('/_nuxt') || path.startsWith('/__nuxt')) return
  await getUser(event).catch((error) => {
    // MarketX down: render signed out rather than fail the page.
    logger.warn('[session] could not resolve user', { requestId: event.context.requestId, error: String(error) })
    event.context.user = null
  })
})
