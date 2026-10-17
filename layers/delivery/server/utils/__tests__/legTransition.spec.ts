import { describe, expect, it } from 'vitest'
import { planLegAction, type LegState } from '../legTransition'

const leg = (over: Partial<LegState> = {}): LegState => ({
  kind: 'LINEHAUL',
  status: 'ASSIGNED',
  collectCode: '111111',
  handoverCode: '222222',
  failedAttempts: 0,
  ...over,
})

describe('planLegAction', () => {
  it('John collects in Jos with the sender code: parcel goes on the road', () => {
    expect(planLegAction(leg(), 'collect', '111111')).toEqual({
      ok: true,
      legStatus: 'COLLECTED',
      parcelStatus: 'IN_TRANSIT',
      events: ['leg.collected'],
      openLastMile: false,
    })
  })

  it('John hands over at the Lagos shop: parcel at hub, last mile opens', () => {
    const plan = planLegAction(leg({ status: 'COLLECTED' }), 'handover', ' 222222 ')
    expect(plan).toMatchObject({
      ok: true,
      parcelStatus: 'AT_HUB',
      openLastMile: true,
      events: ['handover.completed', 'lastmile.created'],
    })
  })

  it('courier hands to the recipient: delivered, nothing else opens', () => {
    const plan = planLegAction(leg({ kind: 'LASTMILE', status: 'COLLECTED' }), 'handover', '222222')
    expect(plan).toMatchObject({ ok: true, parcelStatus: 'DELIVERED', openLastMile: false })
  })

  it('the collect code cannot be used to hand over', () => {
    expect(planLegAction(leg({ status: 'COLLECTED' }), 'handover', '111111')).toEqual({
      ok: false,
      reason: 'wrong_code',
      attemptsLeft: 4,
    })
  })

  it('no skipping steps and no going backwards', () => {
    expect(planLegAction(leg(), 'handover', '222222')).toEqual({ ok: false, reason: 'not_yet', attemptsLeft: 5 })
    expect(planLegAction(leg({ status: 'HANDED_OVER' }), 'collect', '111111')).toEqual({
      ok: false,
      reason: 'already_done',
      attemptsLeft: 5,
    })
  })

  it('locks after 5 wrong codes, even with the right one', () => {
    expect(planLegAction(leg({ failedAttempts: 4 }), 'collect', '000000')).toEqual({
      ok: false,
      reason: 'wrong_code',
      attemptsLeft: 0,
    })
    expect(planLegAction(leg({ failedAttempts: 5 }), 'collect', '111111')).toEqual({
      ok: false,
      reason: 'locked',
      attemptsLeft: 0,
    })
  })
})
