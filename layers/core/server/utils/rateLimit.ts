import { AppError } from '../types/errors'

// ponytail: per-process memory; with several instances each counts separately. Move to the database
// or Redis if Posta runs more than one instance.
const hits = new Map<string, number[]>()

/** Allow `max` calls per `windowMs` for a key (a person or an IP), else a 429 in plain words. */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) throw new AppError('SLOW_DOWN', 'Too many tries. Wait a minute and try again.', 429)
  recent.push(now)
  if (hits.size > 10_000) hits.clear()
  hits.set(key, recent)
}
