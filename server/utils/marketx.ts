import type { H3Event } from 'h3'

/**
 * Posta signs people in with their MarketX account. MarketX stays the only place
 * that holds passwords and signs tokens; Posta never sees JWT_SECRET. It asks
 * MarketX "who owns this token?" instead (GET /api/profile), which also
 * respects MarketX session revocation and account suspension.
 *
 * When Axioms moves MarketX to ES256 + JWKS, verifyAccessToken can check the
 * signature locally and this round trip goes away.
 */

export interface MarketxUser {
  id: string
  email: string
  username?: string
  phone?: string
  role: string
}

export interface Tokens {
  accessToken: string
  refreshToken: string
}

const base = () => useRuntimeConfig().marketxApiUrl.replace(/\/$/, '')

/** MarketX rate-limits logins per IP. Pass the person's IP, or every Posta user shares ours. */
export async function marketxLogin(email: string, password: string, clientIp?: string) {
  const res = await $fetch.raw<{ accessToken: string; refreshToken: string; user: MarketxUser }>(
    `${base()}/api/auth/login`,
    {
      method: 'POST',
      body: { email, password },
      headers: { device: 'Posta', ...(clientIp ? { 'x-forwarded-for': clientIp } : {}) },
      ignoreResponseError: true,
    },
  )
  if (!res.ok) {
    // Wrong password, locked or rate-limited: pass MarketX's message on. Anything else is MarketX failing, not the person.
    if (![400, 401, 403, 423, 429].includes(res.status)) {
      throw createError({ statusCode: 502, statusMessage: 'MarketX sign-in service is unavailable' })
    }
    const message = (res._data as any)?.statusMessage || (res._data as any)?.message || 'Sign in failed'
    throw createError({ statusCode: res.status === 429 ? 429 : 401, statusMessage: message })
  }
  return res._data!
}

// ponytail: per-process memory cache; move to Redis only if Posta runs on more than one instance.
// The 60s means a MarketX logout or suspension reaches Posta within a minute, same as MarketX's own profile cache.
const profileCache = new Map<string, { user: MarketxUser; until: number }>()

/** The MarketX user behind an access token, or null if MarketX rejects it. Throws if MarketX is down. */
export async function verifyAccessToken(accessToken: string): Promise<MarketxUser | null> {
  const hit = profileCache.get(accessToken)
  if (hit && hit.until > Date.now()) return hit.user

  const res = await $fetch.raw<{ data: MarketxUser }>(`${base()}/api/profile`, {
    headers: { authorization: `Bearer ${accessToken}` },
    ignoreResponseError: true,
  })
  if (res.status === 401 || res.status === 403) return null
  // Don't sign people out because MarketX had a bad moment.
  if (!res.ok) throw createError({ statusCode: 502, statusMessage: 'MarketX sign-in service is unavailable' })

  const { id, email, username, phone, role } = res._data!.data
  const user = { id, email, username, phone, role }
  if (profileCache.size > 5000) profileCache.clear()
  profileCache.set(accessToken, { user, until: Date.now() + 60_000 })
  return user
}

// MarketX rotates refresh tokens: a second refresh with the same token gets a 401.
// Two requests arriving together with an expired access token must share one refresh.
const refreshing = new Map<string, Promise<Tokens | null>>()

export function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  let p = refreshing.get(refreshToken)
  if (!p) {
    p = $fetch
      .raw<Tokens>(`${base()}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'x-refresh-token': refreshToken },
        ignoreResponseError: true,
      })
      .then((res) => (res.ok && res._data?.refreshToken ? res._data : null))
      .finally(() => setTimeout(() => refreshing.delete(refreshToken), 10_000))
    refreshing.set(refreshToken, p)
  }
  return p
}

/** Ends the MarketX session. The refresh token is what matters: it would otherwise live 7 more days. */
export function marketxLogout(accessToken?: string, refreshToken?: string) {
  return $fetch(`${base()}/api/auth/logout`, {
    method: 'POST',
    headers: {
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(refreshToken ? { 'x-refresh-token': refreshToken } : {}),
    },
  }).catch(() => {})
}

// ─── Posta's own cookies ─────────────────────────────────────────────────────

const cookieOpts = {
  httpOnly: true,
  secure: !import.meta.dev,
  sameSite: 'lax' as const,
  path: '/',
}

export function setTokens(event: H3Event, t: Tokens) {
  setCookie(event, 'posta_at', t.accessToken, { ...cookieOpts, maxAge: 60 * 60 }) // MarketX access tokens live 1h
  setCookie(event, 'posta_rt', t.refreshToken, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 })
}

export function clearTokens(event: H3Event) {
  deleteCookie(event, 'posta_at', cookieOpts)
  deleteCookie(event, 'posta_rt', cookieOpts)
}

/** The signed-in MarketX user, or null. Refreshes an expired access token on the way. */
export async function getUser(event: H3Event): Promise<MarketxUser | null> {
  if (event.context.user !== undefined) return event.context.user

  const at = getCookie(event, 'posta_at')
  let user = at ? await verifyAccessToken(at) : null

  if (!user) {
    const rt = getCookie(event, 'posta_rt')
    const fresh = rt ? await refreshTokens(rt) : null
    if (fresh) {
      setTokens(event, fresh)
      user = await verifyAccessToken(fresh.accessToken)
    } else if (rt) {
      clearTokens(event)
    }
  }

  event.context.user = user
  return user
}

export async function requireUser(event: H3Event): Promise<MarketxUser> {
  const user = await getUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sign in with your MarketX account' })
  return user
}
