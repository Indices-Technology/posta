import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePostcode } from '../../../../../shared/utils/postcode'
import { reverseGeocode } from '../postcodeApi'

// NIPOST answers through $fetch.raw: { status, ok, _data }.
const nipost = (status: number, data?: unknown) => {
  const raw = vi.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300, _data: data })
  vi.stubGlobal('$fetch', Object.assign(vi.fn(), { raw }))
  return raw
}

beforeEach(() => {
  vi.stubGlobal('useRuntimeConfig', () => ({ postcodeApiKey: 'nipost_test_abc' }))
  vi.stubGlobal('logger', { warn: vi.fn(), error: vi.fn() })
  vi.stubGlobal('normalizePostcode', normalizePostcode)
})
afterEach(() => vi.unstubAllGlobals())

describe('reverseGeocode', () => {
  it('asks NIPOST with our key and the 250 m maximum, and returns the dashed postcode', async () => {
    const raw = nipost(200, {
      data: {
        found: true,
        radius_m: 250,
        unit: { postcode: 'FC-01-A01-KP-27', display: 'FC 01 A01 KP 27', distance_m: 12.4, confidence: 'high', lga_name: 'AMAC', state_name: 'FCT' },
      },
    })
    expect(await reverseGeocode(9.05, 7.49)).toEqual({
      postcode: 'FC-01-A01-KP-27',
      distanceM: 12,
      confidence: 'high',
      address: null,
      place: 'AMAC, FCT',
    })
    const [url, opts] = raw.mock.calls[0]!
    expect(url).toBe('https://api.postcode.gov.ng/v1/search/reverse')
    expect(opts.query).toEqual({ lat: 9.05, lng: 7.49, max_distance_m: 250 })
    expect(opts.headers['X-API-Key']).toBe('nipost_test_abc')
  })

  it('returns null when no building is in range', async () => {
    nipost(200, { data: { found: false, radius_m: 250, message: 'No unit within radius' } })
    expect(await reverseGeocode(9.05, 7.49)).toBeNull()
  })

  it('a rejected key is our problem: a 502 with a "type it instead" message, logged', async () => {
    nipost(401, { error: 'invalid key' })
    await expect(reverseGeocode(9.05, 7.49)).rejects.toMatchObject({ status: 502, code: 'POSTCODE_UNAVAILABLE' })
  })

  it('rate limiting asks the person to wait', async () => {
    nipost(429)
    await expect(reverseGeocode(9.05, 7.49)).rejects.toMatchObject({ status: 429 })
  })

  it('no key configured says so, instead of calling NIPOST', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ postcodeApiKey: '' }))
    const raw = nipost(200)
    await expect(reverseGeocode(9.05, 7.49)).rejects.toMatchObject({ status: 503, code: 'POSTCODE_NOT_SET_UP' })
    expect(raw).not.toHaveBeenCalled()
  })
})
