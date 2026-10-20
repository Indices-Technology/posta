/**
 * Who gets offered a job first. Pure, so it is tested alone.
 *   1. the courier the sender picked, if still available
 *   2. individual couriers by distance from where the job starts, then by how busy they are
 *   3. courier companies last: they run their own dispatch, so they take the job straight away
 * Couriers already asked for this job are skipped.
 */
import { km } from '../../../delivery/server/utils/matching'

export interface Candidate {
  id: string
  kind: 'INDIVIDUAL' | 'COMPANY'
  lastLat: number | null
  lastLng: number | null
  openJobs: number
}

export function rankCouriers<C extends Candidate>(
  candidates: C[],
  start: { lat: number; lng: number } | null,
  opts: { preferredId?: string | null; exclude?: string[] } = {},
): C[] {
  const exclude = new Set(opts.exclude ?? [])
  const distance = (c: C) =>
    start && c.lastLat != null && c.lastLng != null ? km(start.lat, start.lng, c.lastLat, c.lastLng) : Number.POSITIVE_INFINITY

  return candidates
    .filter((c) => !exclude.has(c.id))
    .sort((a, b) => {
      if (a.id === opts.preferredId) return -1
      if (b.id === opts.preferredId) return 1
      if (a.kind !== b.kind) return a.kind === 'INDIVIDUAL' ? -1 : 1
      return distance(a) - distance(b) || a.openJobs - b.openJobs
    })
}

/** Distance as senders see it: rounded to half a kilometre, never a courier's exact spot. */
export const roughKm = (d: number) => (Number.isFinite(d) ? Math.max(0.5, Math.round(d * 2) / 2) : null)
