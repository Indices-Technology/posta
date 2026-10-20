import { describe, expect, it } from 'vitest'
import { buildJourney, type JourneyInput } from '../journey'

const hub = { name: 'Yaba Partner Shop', lat: 6.5095, lng: 3.3711 }
const parcel = (over: Partial<JourneyInput> = {}): JourneyInput => ({
  status: 'IN_TRANSIT',
  fromCity: 'Jos',
  toCity: 'Lagos',
  pickupLat: 9.931234,
  pickupLng: 8.894567,
  dropLat: 6.501234,
  dropLng: 3.364567,
  hub,
  ...over,
})

describe('buildJourney', () => {
  it('the sender sees exact pins: pickup, centre, door', () => {
    const j = buildJourney(parcel(), 'owner')!
    expect(j.stops.map((s) => [s.key, s.lat, s.lng])).toEqual([
      ['pickup', 9.931234, 8.894567],
      ['hub', 6.5095, 3.3711],
      ['drop', 6.501234, 3.364567],
    ])
  })

  it('a tracking link shows the pickup city only and the door to ~1 km', () => {
    const j = buildJourney(parcel(), 'public')!
    expect(j.stops[0]).toMatchObject({ key: 'pickup', lat: 9.9285, lng: 8.8921 }) // Jos city centre
    expect(j.stops[2]).toMatchObject({ key: 'drop', lat: 6.5, lng: 3.36 })
    expect(j.stops[1]).toMatchObject({ key: 'hub', lat: 6.5095, lng: 3.3711 }) // businesses stay exact
  })

  it('on the road: moving from the pickup towards the centre, in words, never a position', () => {
    expect(buildJourney(parcel(), 'owner')).toMatchObject({ at: 0, moving: true, between: 'Between Jos and Yaba Partner Shop' })
  })

  it('progress follows the parcel status', () => {
    const at = (status: string) => {
      const j = buildJourney(parcel({ status }), 'owner')!
      return [j.at, j.moving]
    }
    expect(at('MATCHED')).toEqual([0, false])
    expect(at('AT_HUB')).toEqual([1, false])
    expect(at('OUT_FOR_DELIVERY')).toEqual([1, true])
    expect(at('DELIVERED')).toEqual([2, false])
  })

  it('before matching there is no centre yet: pickup straight to the door', () => {
    const j = buildJourney(parcel({ status: 'NEW', hub: null }), 'owner')!
    expect(j.stops.map((s) => s.key)).toEqual(['pickup', 'drop'])
    expect(j.moving).toBe(false)
  })

  it('with both centres: pickup, origin centre, destination centre, door', () => {
    const terminus = { name: 'Terminus Market Centre', lat: 9.92, lng: 8.89 }
    const j = buildJourney(parcel({ status: 'AT_ORIGIN', origin: terminus }), 'owner')!
    expect(j.stops.map((s) => s.key)).toEqual(['pickup', 'origin', 'hub', 'drop'])
    expect([j.at, j.moving]).toEqual([1, false])
    expect(buildJourney(parcel({ status: 'IN_TRANSIT', origin: terminus }), 'owner')).toMatchObject({
      at: 1,
      moving: true,
      between: 'Between Terminus Market Centre and Yaba Partner Shop',
    })
    expect(buildJourney(parcel({ status: 'WITH_COURIER', origin: terminus }), 'owner')).toMatchObject({ at: 0, moving: true })
  })

  it('collection ends at the destination centre, not the door', () => {
    const j = buildJourney(parcel({ status: 'READY_FOR_COLLECTION', lastMile: 'COLLECT' }), 'owner')!
    expect(j.stops.map((s) => s.key)).toEqual(['pickup', 'hub'])
    expect([j.at, j.moving]).toEqual([1, false])
  })

  it('without pins it falls back to city centres, and gives up for unknown cities', () => {
    const j = buildJourney(parcel({ pickupLat: null, pickupLng: null, dropLat: null, dropLng: null, hub: null }), 'owner')!
    expect(j.stops.map((s) => s.key)).toEqual(['pickup', 'drop'])
    expect(buildJourney(parcel({ fromCity: 'Nowhere', toCity: 'Elsewhere', pickupLat: null, dropLat: null, hub: null }), 'owner')).toBeNull()
  })
})

describe('delivered', () => {
  it('a parcel ready for collection is at its last stop but not delivered', () => {
    expect(buildJourney(parcel({ status: 'READY_FOR_COLLECTION', lastMile: 'COLLECT' }), 'owner')!.delivered).toBe(false)
    expect(buildJourney(parcel({ status: 'DELIVERED', lastMile: 'COLLECT' }), 'owner')!.delivered).toBe(true)
  })
})
