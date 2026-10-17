import { describe, expect, it } from 'vitest'
import { matchParcels, nearestPoint } from '../matching'

const at = (hhmm: string) => new Date(`2026-10-24T${hhmm}:00Z`)

describe('matchParcels', () => {
  it('oldest parcel takes the earliest trip with room; full and departed trips are skipped', () => {
    const parcels = [
      { id: 'p-new', fromCity: 'Jos', toCity: 'Lagos', createdAt: at('05:00') },
      { id: 'p-old', fromCity: 'jos', toCity: 'LAGOS ', createdAt: at('01:00') },
      { id: 'p-abuja', fromCity: 'Jos', toCity: 'Abuja', createdAt: at('01:00') },
    ]
    const trips = [
      { id: 'left', fromCity: 'Jos', toCity: 'Lagos', departAt: at('05:30'), capacity: 5, carrying: 0 },
      { id: 'later', fromCity: 'Jos', toCity: 'Lagos', departAt: at('12:00'), capacity: 5, carrying: 0 },
      { id: 'john', fromCity: 'Jos', toCity: 'Lagos', departAt: at('07:00'), capacity: 2, carrying: 1 },
    ]
    expect(matchParcels(parcels, trips, at('06:00'))).toEqual([
      { parcelId: 'p-old', tripId: 'john' },
      { parcelId: 'p-new', tripId: 'later' },
    ])
  })
})

describe('nearestPoint', () => {
  const points = [
    { id: 'ikeja', city: 'Lagos', lat: 6.6018, lng: 3.3515 },
    { id: 'yaba', city: 'Lagos', lat: 6.5095, lng: 3.3711 },
    { id: 'jos', city: 'Jos', lat: 9.9285, lng: 8.8921 },
  ]

  it('picks the closest point in the city to the drop-off pin', () => {
    expect(nearestPoint(points, 'Lagos', 6.5, 3.38)?.id).toBe('yaba')
    expect(nearestPoint(points, 'Lagos', 6.62, 3.34)?.id).toBe('ikeja')
  })

  it('falls back to the first point in the city without a pin, and none for unknown cities', () => {
    expect(nearestPoint(points, 'lagos')?.id).toBe('ikeja')
    expect(nearestPoint(points, 'Kano', 12, 8.5)).toBeUndefined()
  })
})
