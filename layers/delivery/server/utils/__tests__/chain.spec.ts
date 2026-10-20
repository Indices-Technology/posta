import { describe, expect, it } from 'vitest'
import { buildChain, confirmer, readiness, statusAfter, initialStatus } from '../chain'

const path = (c: ReturnType<typeof buildChain>) => c.steps.map((s) => `${s.from.party}>${s.to.party}`)

describe('buildChain', () => {
  it('drop-off, city to city, door delivery: the full five handovers', () => {
    const c = buildChain({ firstMile: 'DROP_OFF', lastMile: 'DOOR', intercity: true, sameCentre: false })
    expect(path(c)).toEqual(['SENDER>CENTRE', 'CENTRE>TRAVELLER', 'TRAVELLER>CENTRE', 'CENTRE>COURIER', 'COURIER>RECIPIENT'])
    expect(c.legs.map((l) => `${l.key}:${l.carrier}`)).toEqual(['middle:TRAVELLER', 'last:COURIER'])
    expect(c.steps.map((s) => s.seq)).toEqual([1, 2, 3, 4, 5])
  })

  it('courier pickup adds the first mile; collection at the centre drops the door courier', () => {
    const c = buildChain({ firstMile: 'PICKUP', lastMile: 'COLLECT', intercity: true, sameCentre: false })
    expect(path(c)).toEqual(['SENDER>COURIER', 'COURIER>CENTRE', 'CENTRE>TRAVELLER', 'TRAVELLER>CENTRE', 'CENTRE>RECIPIENT'])
    expect(c.steps[1]!.to.ref).toBe('origin')
    expect(c.steps[4]!.from.ref).toBe('dest')
  })

  it('same city, different centres: a courier moves it between them, no traveller', () => {
    const c = buildChain({ firstMile: 'DROP_OFF', lastMile: 'DOOR', intercity: false, sameCentre: false })
    expect(path(c)).toEqual(['SENDER>CENTRE', 'CENTRE>COURIER', 'COURIER>CENTRE', 'CENTRE>COURIER', 'COURIER>RECIPIENT'])
    expect(c.legs.map((l) => l.carrier)).toEqual(['COURIER', 'COURIER'])
  })

  it('same centre at both ends: drop off and collect at the same shop', () => {
    const c = buildChain({ firstMile: 'DROP_OFF', lastMile: 'COLLECT', intercity: false, sameCentre: true })
    expect(path(c)).toEqual(['SENDER>CENTRE', 'CENTRE>RECIPIENT'])
    expect(c.steps[1]!.from.ref).toBe('origin')
  })
})

describe('who scans', () => {
  it('the taker scans; the recipient shows instead', () => {
    expect(confirmer('SENDER', 'CENTRE')).toBe('to')
    expect(confirmer('CENTRE', 'TRAVELLER')).toBe('to')
    expect(confirmer('COURIER', 'RECIPIENT')).toBe('from')
    expect(confirmer('CENTRE', 'RECIPIENT')).toBe('from')
  })
})

describe('statusAfter', () => {
  it('follows the parcel along the chain', () => {
    expect(initialStatus('PICKUP')).toBe('AWAITING_PICKUP')
    expect(initialStatus('DROP_OFF')).toBe('AWAITING_DROPOFF')
    expect(statusAfter({ toParty: 'COURIER', toFinalCentre: false, toLegKind: 'FIRST_MILE' }, 'DOOR')).toBe('WITH_COURIER')
    expect(statusAfter({ toParty: 'CENTRE', toFinalCentre: false }, 'DOOR')).toBe('AT_ORIGIN')
    expect(statusAfter({ toParty: 'TRAVELLER', toFinalCentre: false }, 'DOOR')).toBe('IN_TRANSIT')
    expect(statusAfter({ toParty: 'COURIER', toFinalCentre: false, toLegKind: 'LINEHAUL' }, 'DOOR')).toBe('IN_TRANSIT')
    expect(statusAfter({ toParty: 'CENTRE', toFinalCentre: true }, 'DOOR')).toBe('AT_HUB')
    expect(statusAfter({ toParty: 'CENTRE', toFinalCentre: true }, 'COLLECT')).toBe('READY_FOR_COLLECTION')
    expect(statusAfter({ toParty: 'COURIER', toFinalCentre: false, toLegKind: 'LASTMILE' }, 'DOOR')).toBe('OUT_FOR_DELIVERY')
    expect(statusAfter({ toParty: 'RECIPIENT', toFinalCentre: false }, 'DOOR')).toBe('DELIVERED')
  })
})

describe('readiness', () => {
  const h = (seq: number, status: string, fromAssigned = true, toAssigned = true) => ({ seq, status, fromAssigned, toAssigned })

  it('only the first unfinished handover can happen, and only once both sides are assigned', () => {
    expect([...readiness([h(1, 'DONE'), h(2, 'WAITING'), h(3, 'WAITING')])]).toEqual([[1, 'DONE'], [2, 'READY'], [3, 'WAITING']])
    // No traveller matched yet: the centre can't hand it over, and nothing after it is ready.
    expect([...readiness([h(1, 'DONE'), h(2, 'WAITING', true, false), h(3, 'WAITING')])]).toEqual([[1, 'DONE'], [2, 'WAITING'], [3, 'WAITING']])
  })

  it('a traveller unassigned after accepting turns a READY step back to WAITING', () => {
    expect(readiness([h(1, 'DONE'), h(2, 'READY', true, false)]).get(2)).toBe('WAITING')
  })
})
