export default defineEventHandler(async (event) => {
  await marketxLogout(getCookie(event, 'posta_at'), getCookie(event, 'posta_rt'))
  clearTokens(event)
  return { ok: true }
})
