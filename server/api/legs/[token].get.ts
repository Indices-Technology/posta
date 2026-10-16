// Public: the link itself is the carrier's credential.
export default defineEventHandler((event) => loadLegView(getRouterParam(event, 'token')!))
