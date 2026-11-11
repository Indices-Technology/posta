/**
 * Server-to-server clients (MarketX first) authenticate with an API key in `x-posta-key`.
 *
 * NUXT_API_KEYS holds one entry per client, "name:<sha256 hex of the key>", comma-separated.
 * Only hashes are stored, so a leaked config does not leak keys. Revoke a client by removing
 * its entry. Make a key and its hash:
 *   node -e "const k='pk_'+require('crypto').randomBytes(24).toString('base64url');console.log(k, require('crypto').createHash('sha256').update(k).digest('hex'))"
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { AppError } from '../../../core/server/types/errors'

/** The client a key belongs to, or null. Pure, so it is tested alone. */
export function matchClient(config: string, key: string | undefined | null): string | null {
  if (!key) return null
  const given = createHash('sha256').update(key).digest()
  for (const entry of config.split(',')) {
    const [name, hex] = entry.trim().split(':')
    if (!name || !hex || hex.length !== 64) continue
    if (timingSafeEqual(given, Buffer.from(hex, 'hex'))) return name
  }
  return null
}

export function requireClient(event: H3Event): string {
  const client = matchClient(String(useRuntimeConfig().apiKeys ?? ''), getHeader(event, 'x-posta-key'))
  if (!client) throw new AppError('BAD_API_KEY', 'A valid x-posta-key is required', 401)
  return client
}
