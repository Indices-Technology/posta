// GET /api/auth/me — the signed-in user, or null.
export default defineApiHandler((event) => getUser(event))
