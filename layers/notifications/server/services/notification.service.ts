/**
 * Outbox: every message is a row before it is sent.
 *   1. queue(items, tx)  inside the caller's transaction. In-app messages are delivered by being written.
 *   2. send(ids)          after the transaction commits. Failures stay PENDING.
 *   3. flushDue()         the scheduled task (every minute) retries with backoff, then gives up.
 * At-least-once: webhook receivers dedupe on the notification id.
 *
 * Explicit imports only, so scripts and tasks can use it outside a request.
 */
import type { Prisma } from '@prisma/client'
import { logger } from '~~/server/utils/logger'
import { courierRepository } from '~~/layers/couriers/server/repositories/courier.repository'
import { notificationRepository } from '../repositories/notification.repository'
import { TEMPLATES, renderText, type Template, type TemplateKey } from '../utils/templates'
import { nextAttemptAt } from '../utils/retry'
import { sendWhatsappTemplate, whatsappConfigured } from '../utils/channels/whatsapp'
import { postWebhook } from '../utils/channels/webhook'

type Params = Record<string, unknown>
type Channel = 'IN_APP' | 'WHATSAPP' | 'WEBHOOK'

export interface Outgoing {
  channel: Channel
  template: TemplateKey
  params: Params
  toUserId?: string | null
  forStaff?: boolean
  toPhone?: string
  courierId?: string
  parcelId?: string
}

/** Builders for the four kinds of recipient. */
export const to = {
  user: (userId: string, template: TemplateKey, params: Params, parcelId?: string): Outgoing => ({ channel: 'IN_APP', toUserId: userId, template, params, parcelId }),
  staff: (template: TemplateKey, params: Params, parcelId?: string): Outgoing => ({ channel: 'IN_APP', forStaff: true, template, params, parcelId }),
  whatsapp: (phone: string, template: TemplateKey, params: Params, parcelId?: string): Outgoing => ({ channel: 'WHATSAPP', toPhone: phone, template, params, parcelId }),
  company: (courierId: string, template: TemplateKey, params: Params, parcelId?: string): Outgoing => ({ channel: 'WEBHOOK', courierId, template, params, parcelId }),
}

type Row = NonNullable<Awaited<ReturnType<typeof notificationRepository.findById>>>

async function deliverOnChannel(n: Row): Promise<'SENT' | 'SKIPPED'> {
  const params = n.params as Params
  if (n.channel === 'IN_APP') return 'SENT'

  if (n.channel === 'WHATSAPP') {
    const wa = (TEMPLATES as Record<string, Template>)[n.template]?.whatsapp
    if (!wa) throw new Error(`No WhatsApp template for ${n.template}`)
    if (!whatsappConfigured()) {
      // Visible in dev logs so the flow can be followed without a WhatsApp number.
      logger.info('[notify] WhatsApp not set up, skipped', { to: n.toPhone, text: renderText(n.template, params) })
      return 'SKIPPED'
    }
    await sendWhatsappTemplate(n.toPhone!, wa.name, wa.params.map((k) => String(params[k] ?? '')))
    return 'SENT'
  }

  const courier = n.courierId ? await courierRepository.findById(n.courierId) : null
  if (!courier?.webhookUrl || !courier.webhookSecret) return 'SKIPPED'
  await postWebhook(courier.webhookUrl, courier.webhookSecret, { id: n.id, event: n.template, createdAt: n.createdAt, data: params })
  return 'SENT'
}

export const notificationService = {
  /** Write messages, ideally inside the caller's transaction. Returns ids to send after commit. */
  async queue(items: Outgoing[], db?: Prisma.TransactionClient) {
    const now = new Date()
    const rows = await notificationRepository.createMany(
      items.map((i) => ({
        ...i,
        params: i.params as Prisma.InputJsonValue,
        status: i.channel === 'IN_APP' ? ('SENT' as const) : ('PENDING' as const),
        sentAt: i.channel === 'IN_APP' ? now : null,
      })),
      db,
    )
    return rows.filter((r) => r.status === 'PENDING').map((r) => r.id)
  },

  /** Try to send now. Never throws: whatever fails is retried by the scheduled task. */
  async send(ids: string[]) {
    for (const id of ids) {
      await this.deliver(id).catch((error) => logger.logError('[notify] deliver', error, { id }))
    }
  },

  /** For the scheduled task: everything due, oldest first. */
  async flushDue(limit = 50) {
    const due = await notificationRepository.listDueIds(new Date(), limit)
    await this.send(due.map((d) => d.id))
    return due.length
  },

  async deliver(id: string) {
    const n = await notificationRepository.findById(id)
    if (!n || n.status !== 'PENDING') return

    const attempt = n.attempts + 1
    const retryAt = nextAttemptAt(attempt)
    // Claim first: only one worker sends, and a crash mid-send is retried at retryAt.
    if (!(await notificationRepository.claim(id, n.attempts, retryAt ?? new Date(Date.now() + 3_600_000)))) return

    try {
      const outcome = await deliverOnChannel(n)
      await notificationRepository.finish(id, {
        status: outcome,
        sentAt: outcome === 'SENT' ? new Date() : null,
        lastError: outcome === 'SKIPPED' ? 'Channel not set up' : null,
      })
    } catch (error) {
      const message = (error as Error).message.slice(0, 500)
      await notificationRepository.finish(id, retryAt ? { lastError: message } : { status: 'FAILED', lastError: message })
      logger.warn('[notify] send failed', { id, attempt, willRetry: !!retryAt, error: message })
    }
  },

  /** The in-app inbox, rendered: icon + one line of text. */
  async inbox(userId: string, staff: boolean) {
    const [rows, unread] = await Promise.all([
      notificationRepository.listInbox(userId, staff),
      notificationRepository.countUnread(userId, staff),
    ])
    return {
      unread,
      items: rows.map((r) => ({
        id: r.id,
        text: renderText(r.template, r.params as Params),
        icon: (TEMPLATES as Record<string, Template>)[r.template]?.icon ?? 'chat',
        parcelId: r.parcelId,
        forStaff: r.forStaff,
        read: !!r.readAt,
        at: r.createdAt,
      })),
    }
  },

  unreadCount: (userId: string, staff: boolean) => notificationRepository.countUnread(userId, staff),
  markAllRead: (userId: string, staff: boolean) => notificationRepository.markAllRead(userId, staff).then(() => null),
}
