import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planLegAction, type LegState } from './leg.ts'
import { matchParcels, nearestPoint } from './match.ts'

const leg = (over: Partial<LegState> = {}): LegState => ({
  kind: 'LINEHAUL',
  status: 'ASSIGNED',
  collectCode: '111111',
  handoverCode: '222222',
  failedAttempts: 0,
  ...over,
})

test('John collects in Jos with the sender code: parcel goes in transit', () => {
  const plan = planLegAction(leg(), 'collect', '111111')
  assert.deepEqual(plan, {
    ok: true,
    legStatus: 'COLLECTED',
    parcelStatus: 'IN_TRANSIT',
    events: ['leg.collected'],
    openLastMile: false,
  })
})

test('John hands over at the Lagos shop: parcel at hub, last mile opens', () => {
  const plan = planLegAction(leg({ status: 'COLLECTED' }), 'handover', ' 222222 ')
  assert.ok(plan.ok)
  assert.equal(plan.parcelStatus, 'AT_HUB')
  assert.equal(plan.openLastMile, true)
  assert.deepEqual(plan.events, ['handover.completed', 'lastmile.created'])
})

test('courier hands to customer: delivered, nothing else opens', () => {
  const plan = planLegAction(leg({ kind: 'LASTMILE', status: 'COLLECTED' }), 'handover', '222222')
  assert.ok(plan.ok)
  assert.equal(plan.parcelStatus, 'DELIVERED')
  assert.equal(plan.openLastMile, false)
})

test('the collect code cannot be used to hand over', () => {
  const plan = planLegAction(leg({ status: 'COLLECTED' }), 'handover', '111111')
  assert.deepEqual(plan, { ok: false, reason: 'wrong_code', attemptsLeft: 4 })
})

test('no skipping steps and no going backwards', () => {
  assert.deepEqual(planLegAction(leg(), 'handover', '222222'), { ok: false, reason: 'not_yet', attemptsLeft: 5 })
  const done = leg({ status: 'HANDED_OVER' })
  assert.deepEqual(planLegAction(done, 'collect', '111111'), { ok: false, reason: 'already_done', attemptsLeft: 5 })
})

test('locked after 5 wrong codes, even with the right one', () => {
  assert.deepEqual(planLegAction(leg({ failedAttempts: 4 }), 'collect', '000000'), {
    ok: false,
    reason: 'wrong_code',
    attemptsLeft: 0,
  })
  assert.deepEqual(planLegAction(leg({ failedAttempts: 5 }), 'collect', '111111'), {
    ok: false,
    reason: 'locked',
    attemptsLeft: 0,
  })
})

const at = (s: string) => new Date(`2026-10-24T${s}:00Z`)
const now = at('06:00')

test('oldest parcel takes the earliest trip with room; full and departed trips are skipped', () => {
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
  assert.deepEqual(matchParcels(parcels, trips, now), [
    { parcelId: 'p-old', tripId: 'john' },
    { parcelId: 'p-new', tripId: 'later' },
  ])
})

test('nearest handover point by drop pin, first in city without one', () => {
  const points = [
    { id: 'ikeja', city: 'Lagos', lat: 6.6018, lng: 3.3515 },
    { id: 'yaba', city: 'Lagos', lat: 6.5095, lng: 3.3711 },
    { id: 'jos', city: 'Jos', lat: 9.9285, lng: 8.8921 },
  ]
  assert.equal(nearestPoint(points, 'Lagos', 6.5, 3.38)?.id, 'yaba') // Surulere side
  assert.equal(nearestPoint(points, 'Lagos', 6.62, 3.34)?.id, 'ikeja')
  assert.equal(nearestPoint(points, 'lagos')?.id, 'ikeja')
  assert.equal(nearestPoint(points, 'Kano', 12, 8.5), undefined)
})
