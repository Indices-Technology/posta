import { afterEach, describe, expect, it } from 'vitest'
import { moves } from '../shipmentStatus'
import { clientWebhook, signWebhook, verifyWebhook } from '../../../../notifications/server/utils/channels/webhook'

describe('moves', () => {
  it('goes forward only', () => {
    expect(moves('BOOKING', 'PRE_TRANSIT')).toBe(true)
    expect(moves('PRE_TRANSIT', 'IN_TRANSIT')).toBe(true)
    expect(moves('IN_TRANSIT', 'DELIVERED')).toBe(true)
    expect(moves('OUT_FOR_DELIVERY', 'IN_TRANSIT')).toBe(false)
    expect(moves('IN_TRANSIT', 'IN_TRANSIT')).toBe(false)
  })
  it('never leaves an end state, and ignores UNKNOWN', () => {
    expect(moves('DELIVERED', 'RETURNED')).toBe(false)
    expect(moves('FAILURE', 'DELIVERED')).toBe(false)
    expect(moves('PRE_TRANSIT', 'UNKNOWN')).toBe(false)
  })
})

describe('client webhooks', () => {
  afterEach(() => delete process.env.NUXT_CLIENT_WEBHOOKS)

  it('reads the client from NUXT_CLIENT_WEBHOOKS, and nothing from bad JSON', () => {
    process.env.NUXT_CLIENT_WEBHOOKS = '{"marketx":{"url":"https://m.test/api/posta/webhook","secret":"whsec_x"}}'
    expect(clientWebhook('marketx')).toEqual({ url: 'https://m.test/api/posta/webhook', secret: 'whsec_x' })
    expect(clientWebhook('other')).toBeNull()
    process.env.NUXT_CLIENT_WEBHOOKS = '{oops'
    expect(clientWebhook('marketx')).toBeNull()
  })

  it('signs so the receiver can verify, and a changed body fails', () => {
    const body = JSON.stringify({ id: 'n1', event: 'shipment.updated', data: { status: 'DELIVERED' } })
    const header = signWebhook('whsec_x', body)
    expect(verifyWebhook('whsec_x', body, header)).toBe(true)
    expect(verifyWebhook('whsec_x', body.replace('DELIVERED', 'RETURNED'), header)).toBe(false)
  })
})
