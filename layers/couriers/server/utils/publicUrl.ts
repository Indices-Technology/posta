/**
 * A company's webhook address must be public https: never localhost or a private network,
 * or a "courier company" could make Posta's server call internal systems.
 * ponytail: checks the address as written; a hostname that later resolves to a private IP
 * (DNS rebinding) isn't caught. Resolve-and-pin at send time if companies become self-serve.
 */
const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^0\./]

export function isPublicHttpsUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password) return false
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false
  if (host.startsWith('[')) return false // IPv6 literals: no legitimate courier company needs one
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && PRIVATE_V4.some((r) => r.test(host))) return false
  return host.includes('.')
}
