/**
 * Ranking delivery options. Pure, so it is tested alone.
 *
 *   best-value  weighted score: price 60%, time 30%, insurance 10% (lower is better)
 *   cheapest    price, then time
 *   fastest     time, then price
 *   safest      insurance cover, then best-value
 *
 * Price is what the buyer pays in total, including cash handed to a rider.
 * Unknown delivery time counts as the slowest in the set.
 */

export type Strategy = 'best-value' | 'cheapest' | 'fastest' | 'safest'
export type Badge = 'cheapest' | 'fastest' | 'insured'

export interface Rankable {
  totalMinor: number
  etaMaxHours?: number
  coverMinor: number
}

const WEIGHTS = { price: 0.6, time: 0.3, insurance: 0.1 }

export function rankQuotes<T extends Rankable>(quotes: T[], strategy: Strategy = 'best-value'): (T & { score: number; badges: Badge[] })[] {
  if (!quotes.length) return []

  const prices = quotes.map((q) => q.totalMinor)
  const etas = quotes.map((q) => q.etaMaxHours).filter((h): h is number => h != null)
  const [minP, maxP] = [Math.min(...prices), Math.max(...prices)]
  const [minT, maxT] = etas.length ? [Math.min(...etas), Math.max(...etas)] : [0, 0]
  const norm = (x: number, lo: number, hi: number) => (hi > lo ? (x - lo) / (hi - lo) : 0)
  const eta = (q: T) => q.etaMaxHours ?? Number.POSITIVE_INFINITY

  const scored = quotes.map((q) => {
    const score =
      WEIGHTS.price * norm(q.totalMinor, minP, maxP) +
      WEIGHTS.time * (q.etaMaxHours == null ? 1 : norm(q.etaMaxHours, minT, maxT)) +
      WEIGHTS.insurance * (q.coverMinor > 0 ? 0 : 1)
    // Badges only mean something when there is a choice.
    const badges: Badge[] = []
    if (quotes.length > 1 && q.totalMinor === minP) badges.push('cheapest')
    if (quotes.length > 1 && etas.length && q.etaMaxHours === minT) badges.push('fastest')
    if (q.coverMinor > 0) badges.push('insured')
    return { ...q, score: Math.round(score * 1000) / 1000, badges }
  })

  const byPrice = (a: T, b: T) => a.totalMinor - b.totalMinor
  const byTime = (a: T, b: T) => eta(a) - eta(b)
  const byScore = (a: { score: number }, b: { score: number }) => a.score - b.score
  const compare: Record<Strategy, (a: (typeof scored)[number], b: (typeof scored)[number]) => number> = {
    'best-value': (a, b) => byScore(a, b) || byPrice(a, b),
    cheapest: (a, b) => byPrice(a, b) || byTime(a, b),
    fastest: (a, b) => byTime(a, b) || byPrice(a, b),
    safest: (a, b) => b.coverMinor - a.coverMinor || byScore(a, b),
  }
  return scored.sort(compare[strategy])
}
