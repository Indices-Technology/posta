import { describe, expect, it } from 'vitest'
import { rankCouriers, roughKm, type Candidate } from '../ranking'

const c = (id: string, lat: number | null, lng: number | null, openJobs = 0, kind: Candidate['kind'] = 'INDIVIDUAL'): Candidate => ({
  id, kind, lastLat: lat, lastLng: lng, openJobs,
})
const yaba = { lat: 6.5095, lng: 3.3711 }

describe('rankCouriers', () => {
  const near = c('near', 6.51, 3.372)
  const far = c('far', 6.6, 3.35)
  const unknown = c('unknown', null, null)
  const company = c('company', null, null, 0, 'COMPANY')

  it('nearest individual first, unknown positions after, companies last', () => {
    expect(rankCouriers([company, far, unknown, near], yaba).map((x) => x.id)).toEqual(['near', 'far', 'unknown', 'company'])
  })

  it("the sender's pick goes first, wherever they are", () => {
    expect(rankCouriers([near, far], yaba, { preferredId: 'far' })[0]!.id).toBe('far')
  })

  it('couriers already asked are skipped', () => {
    expect(rankCouriers([near, far], yaba, { exclude: ['near'] }).map((x) => x.id)).toEqual(['far'])
  })

  it('equally far: the less busy one first', () => {
    expect(rankCouriers([c('busy', 6.51, 3.372, 3), c('free', 6.51, 3.372, 0)], yaba)[0]!.id).toBe('free')
  })
})

describe('roughKm', () => {
  it('rounds to half a kilometre and never says 0', () => {
    expect(roughKm(0.1)).toBe(0.5)
    expect(roughKm(2.26)).toBe(2.5)
    expect(roughKm(Number.POSITIVE_INFINITY)).toBeNull()
  })
})
