import type { H3Event } from 'h3'
import type { PostaUser } from '../types/user'
import { AppError } from '../types/errors'
import { refreshTokens, verifyAccessToken, type Tokens } from './marketx'

// Posta's own httpOnly cookies holding the MarketX tokens.
const cookieOpts = { httpOnly: true, secure: !import.meta.dev, sameSite: 'lax' as const, path: '/' }

export function setTokens(event: H3Event, t: Tokens) {
  setCookie(event, 'posta_at', t.accessToken, { ...cookieOpts, maxAge: 60 * 60 }) // MarketX access tokens live 1h
  setCookie(event, 'posta_rt', t.refreshToken, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 })
}

export function clearTokens(event: H3Event) {
  deleteCookie(event, 'posta_at', cookieOpts)
  deleteCookie(event, 'posta_rt', cookieOpts)
}

export const readTokens = (event: H3Event) => ({ accessToken: getCookie(event, 'posta_at'), refreshToken: getCookie(event, 'posta_rt') })

/**
 * The signed-in user, or null.
 * Browsers send Posta's cookies (refreshed here when expired). Server clients such as Axioms
 * send the person's MarketX access token as `Authorization: Bearer`; those are never
 * refreshed here, the caller owns its token.
 */
export async function getUser(event: H3Event): Promise<PostaUser | null> {
  if (event.context.user !== undefined) return event.context.user

  const bearer = getHeader(event, 'authorization')
  if (bearer?.startsWith('Bearer ')) {
    event.context.user = await verifyAccessToken(bearer.slice(7))
    return event.context.user
  }

  const { accessToken, refreshToken } = readTokens(event)
  let user = accessToken ? await verifyAccessToken(accessToken) : null

  if (!user && refreshToken) {
    const fresh = await refreshTokens(refreshToken)
    if (fresh) {
      setTokens(event, fresh)
      user = await verifyAccessToken(fresh.accessToken)
    } else {
      clearTokens(event)
    }
  }

  event.context.user = user
  return user
}

export async function requireUser(event: H3Event): Promise<PostaUser> {
  const user = await getUser(event)
  if (!user) throw new AppError('SIGN_IN_REQUIRED', 'Sign in with your MarketX account', 401)
  return user
}

/** Posta staff: MarketX admins and support agents see every parcel and every code. */
export const isOps = (u: PostaUser) => u.role === 'admin' || u.role === 'support_agent'

export function requireOps(u: PostaUser) {
  if (!isOps(u)) throw new AppError('FORBIDDEN', 'Only Posta staff can do this', 403)
}

/** Prisma filter: staff see everything, everyone else what they created. */
export const ownerScope = (u: PostaUser) => (isOps(u) ? {} : { createdBy: u.id })
