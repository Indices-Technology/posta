import { describe, expect, it } from 'vitest'
import { pointIn, statusOf } from '../mapPoint'

describe('pointIn', () => {
  it('prefers the dropped pin over where the map was looking', () => {
    const link = 'https://www.google.com/maps/place/Yaba/@6.51,3.37,17z/data=!3m1!4b1!4m6!3m5!3d6.5095!4d3.3711'
    expect(pointIn(link)).toEqual({ lat: 6.5095, lng: 3.3711 })
  })
  it('reads q=, ll= and @ links, and plain "lat, lng"', () => {
    expect(pointIn('https://maps.google.com/?q=9.0579,7.4951')).toEqual({ lat: 9.0579, lng: 7.4951 })
    expect(pointIn('https://maps.apple.com/?ll=9.9285,8.8921&q=Jos')).toEqual({ lat: 9.9285, lng: 8.8921 })
    expect(pointIn('https://www.google.com/maps/@6.5244,3.3792,15z')).toEqual({ lat: 6.5244, lng: 3.3792 })
    expect(pointIn(' 6.5244, 3.3792 ')).toEqual({ lat: 6.5244, lng: 3.3792 })
    expect(pointIn('https://www.google.com/maps/search/?api=1&query=6.5%2C3.37')).toEqual({ lat: 6.5, lng: 3.37 })
  })
  it('returns null for no point or a point outside Nigeria', () => {
    expect(pointIn('https://maps.app.goo.gl/abc123')).toBeNull()
    expect(pointIn('https://www.google.com/maps/@51.5072,-0.1276,12z')).toBeNull()
  })
})

describe('statusOf', () => {
  it('saves without asking only for a precise point with a high-confidence building', () => {
    expect(statusOf('gps', 'high', false)).toBe('found')
    expect(statusOf('link', 'high', false)).toBe('found')
    expect(statusOf('text', 'high', true)).toBe('found')
  })
  it('asks the person when the match is a neighbour or uncertain', () => {
    expect(statusOf('text', 'high', false)).toBe('check')
    expect(statusOf('gps', 'medium', false)).toBe('check')
    expect(statusOf('link', 'low', false)).toBe('check')
  })
})
