import type { Serialize } from 'nitropack/types'
import { BaseApiClient } from '~~/layers/core/app/services/base.api'
import type { notificationService } from '~~/layers/notifications/server/services/notification.service'

export type Inbox = Serialize<Awaited<ReturnType<typeof notificationService.inbox>>>

export class NotificationApiClient extends BaseApiClient {
  inbox() {
    return this.request<Inbox>('/api/notifications')
  }
  unread() {
    return this.request<number>('/api/notifications/unread')
  }
  markAllRead() {
    return this.request<null>('/api/notifications/read', { method: 'POST' })
  }
}
