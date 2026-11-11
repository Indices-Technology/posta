import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { rankQuotes, type Rankable } from '../rank'
import { matchClient } from '../apiKey'
import { networkPriceMinor } from '../networkPrice'

const q = (id: string, totalMinor: number, etaMaxHours?: number, coverMinor = 0) => ({ id, totalMinor, etaMaxHours, coverMinor }) satisfies Rankable & { id: string }

describe('rankQuotes', () => {
  const cheapSlow = q('cheap-slow', 200_000, 120)
  const dearFast = q('dear-fast', 1_000_000, 24, 5_000_000)
  const middle = q('middle', 400_000, 48)
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

  it('best-value weighs price over time', () => {
    expect(ids(rankQuotes([dearFast, middle, cheapSlow]))).toEqual(['middle', 'cheap-slow', 'dear-fast'])
  })

  it('cheapest and fastest sort on one thing, the other breaks ties', () => {
    expect(ids(rankQuotes([dearFast, middle, cheapSlow], 'cheapest'))).toEqual(['cheap-slow', 'middle', 'dear-fast'])
    expect(ids(rankQuotes([cheapSlow, middle, dearFast], 'fastest'))).toEqual(['dear-fast', 'middle', 'cheap-slow'])
  })

  it('safest puts insured options first', () => {
    expect(rankQuotes([cheapSlow, middle, dearFast], 'safest')[0]!.id).toBe('dear-fast')
  })

  it('unknown delivery time ranks as the slowest', () => {
    expect(ids(rankQuotes([q('unknown', 300_000), q('known', 300_000, 72)], 'fastest'))).toEqual(['known', 'unknown'])
  })

  it('badges: cheapest, fastest and insured, only when there is a choice', () => {
    const [a, b, c] = rankQuotes([cheapSlow, middle, dearFast], 'cheapest')
    expect(a!.badges).toEqual(['cheapest'])
    expect(b!.badges).toEqual([])
    expect(c!.badges).toEqual(['fastest', 'insured'])
    expect(rankQuotes([middle])[0]!.badges).toEqual([])
  })
})

describe('matchClient', () => {
  const hash = (k: string) => createHash('sha256').update(k).digest('hex')
  const config = `marketx:${hash('pk_good')}, axioms:${hash('pk_other')}`

  it('names the client a key belongs to', () => {
    expect(matchClient(config, 'pk_good')).toBe('marketx')
    expect(matchClient(config, 'pk_other')).toBe('axioms')
  })

  it('rejects unknown, empty and malformed', () => {
    expect(matchClient(config, 'pk_bad')).toBeNull()
    expect(matchClient(config, undefined)).toBeNull()
    expect(matchClient('marketx:notahash', 'pk_good')).toBeNull()
    expect(matchClient('', 'pk_good')).toBeNull()
  })
})

describe('networkPriceMinor', () => {
  it('base covers 2 kg, then per started kg, plus door delivery', () => {
    expect(networkPriceMinor(1.5, false, false)).toBe(150_000)
    expect(networkPriceMinor(3.2, false, false)).toBe(150_000 + 2 * 30_000)
    expect(networkPriceMinor(2, true, true)).toBe(350_000 + 100_000)
  })
})
