import type { PostaUser } from '../types/user'
import { AppError } from '../types/errors'

/**
 * Client for MarketX's auth API. Posta signs people in with their MarketX account:
 * MarketX stays the only place that holds passwords and signs tokens. Posta never sees
 * JWT_SECRET; it asks MarketX "who owns this token?" (GET /api/profile), which also
 * honours MarketX session revocation and account suspension.
 *
 * Uses /api/*, not /api/v1/*: the v1 alias returns 404 on marketx.africa.
 * When Axioms moves MarketX to ES256 + JWKS, verifyAccessToken becomes a local signature check.
 */

export interface Tokens {
  accessToken: string
  refreshToken: string
}

const base = () => useRuntimeConfig().marketxApiUrl.replace(/\/$/, '')

/** MarketX rate-limits logins per IP. Pass the person's IP, or every Posta user shares ours. */
export async function marketxLogin(email: string, password: string, clientIp?: string) {
  const res = await $fetch.raw<Tokens & { user: PostaUser }>(`${base()}/api/auth/login`, {
    method: 'POST',
    body: { email, password },
    headers: { device: 'Posta', ...(clientIp ? { 'x-forwarded-for': clientIp } : {}) },
    ignoreResponseError: true,
  })
  if (res.ok) return res._data!

  // Wrong password, locked or rate-limited: pass MarketX's message on. Anything else is MarketX failing.
  if (![400, 401, 403, 423, 429].includes(res.status)) {
    throw new AppError('MARKETX_UNAVAILABLE', 'Sign-in is unavailable right now. Try again shortly.', 502)
  }
  const message = (res._data as any)?.statusMessage || (res._data as any)?.message || 'Sign in failed'
  throw new AppError(res.status === 429 ? 'RATE_LIMITED' : 'BAD_CREDENTIALS', message, res.status === 429 ? 429 : 401)
}

// ponytail: per-process memory cache; move to Redis only if Posta runs on more than one instance.
// 60s means a MarketX logout or suspension reaches Posta within a minute, same as MarketX's own profile cache.
const profileCache = new Map<string, { user: PostaUser; until: number }>()

/** The MarketX user behind an access token, or null if MarketX rejects it. Throws if MarketX is down. */
export async function verifyAccessToken(accessToken: string): Promise<PostaUser | null> {
  const hit = profileCache.get(accessToken)
  if (hit && hit.until > Date.now()) return hit.user

  const res = await $fetch.raw<{ data: PostaUser }>(`${base()}/api/profile`, {
    headers: { authorization: `Bearer ${accessToken}` },
    ignoreResponseError: true,
  })
  if (res.status === 401 || res.status === 403) return null
  // Don't sign people out because MarketX had a bad moment.
  if (!res.ok) throw new AppError('MARKETX_UNAVAILABLE', 'Sign-in is unavailable right now. Try again shortly.', 502)

  const { id, email, username, phone, role } = res._data!.data
  const user = { id, email, username, phone, role }
  if (profileCache.size > 5000) profileCache.clear()
  profileCache.set(accessToken, { user, until: Date.now() + 60_000 })
  return user
}

// MarketX rotates refresh tokens: a second refresh with the same token gets a 401.
// Requests arriving together with an expired access token must share one refresh.
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
