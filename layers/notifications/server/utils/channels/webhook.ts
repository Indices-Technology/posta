import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Signed webhooks to courier companies' systems.
 *
 * Header: x-posta-signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with their secret>
 * The company checks the HMAC with their secret and rejects old timestamps (replay). Body:
 *   { id, event, createdAt, data }   — `id` is stable across retries: use it to ignore duplicates.
 * Any 2xx counts as delivered; anything else is retried with backoff.
 */
export const newWebhookSecret = () => `whsec_${randomBytes(24).toString('base64url')}`

export function signWebhook(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return `t=${timestamp},v1=${v1}`
}

/** What a receiver does (published in the integration guide; also used by our tests). */
export function verifyWebhook(secret: string, body: string, header: string, toleranceSec = 300, now = Date.now()) {
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]))
  const t = Number(parts.t)
  if (!t || !parts.v1 || Math.abs(now / 1000 - t) > toleranceSec) return false
  const expected = Buffer.from(signWebhook(secret, body, t).split('v1=')[1]!)
  const given = Buffer.from(parts.v1)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export async function postWebhook(url: string, secret: string, payload: unknown) {
  const body = JSON.stringify(payload)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-posta-signature': signWebhook(secret, body), 'user-agent': 'Posta-Webhooks/1' },
    body,
    redirect: 'manual', // never follow a redirect to somewhere the company didn't register
    signal: AbortSignal.timeout(8_000),
  })
  if (res.status < 200 || res.status >= 300) throw new Error(`Webhook ${res.status}`)
}
