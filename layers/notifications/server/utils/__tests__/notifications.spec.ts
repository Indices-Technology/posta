import { describe, expect, it } from 'vitest'
import { MAX_ATTEMPTS, nextAttemptAt } from '../retry'
import { signWebhook, verifyWebhook } from '../channels/webhook'
import { toWhatsappNumber } from '../channels/whatsapp'
import { renderText } from '../templates'

const now = new Date('2026-10-17T10:00:00Z')

describe('retry', () => {
  it('backs off 1, 5, 15, 60 minutes, then gives up', () => {
    const waits = [1, 2, 3, 4].map((a) => (nextAttemptAt(a, now)!.getTime() - now.getTime()) / 60_000)
    expect(waits).toEqual([1, 5, 15, 60])
    expect(nextAttemptAt(MAX_ATTEMPTS, now)).toBeNull()
  })
})

describe('webhook signatures', () => {
  const body = JSON.stringify({ id: 'n1', event: 'job.assigned' })

  it('a receiver with the same secret accepts it', () => {
    expect(verifyWebhook('whsec_a', body, signWebhook('whsec_a', body))).toBe(true)
  })

  it('a changed body, wrong secret, or old timestamp is rejected', () => {
    const header = signWebhook('whsec_a', body)
    expect(verifyWebhook('whsec_a', body.replace('n1', 'n2'), header)).toBe(false)
    expect(verifyWebhook('whsec_b', body, header)).toBe(false)
    const old = signWebhook('whsec_a', body, Math.floor(now.getTime() / 1000) - 3600)
    expect(verifyWebhook('whsec_a', body, old, 300, now.getTime())).toBe(false)
  })
})

describe('messages', () => {
  it('WhatsApp numbers: 0803… becomes 234803…', () => {
    expect(toWhatsappNumber('0803 123 4567')).toBe('2348031234567')
    expect(toWhatsappNumber('+234 803 123 4567')).toBe('2348031234567')
  })

  it('renders the inbox text', () => {
    expect(renderText('parcel.at_hub', { ref: '#1001', hub: 'Yaba Partner Shop' })).toBe('#1001 reached Yaba Partner Shop.')
  })
})
