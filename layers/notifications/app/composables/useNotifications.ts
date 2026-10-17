import { NotificationApiClient } from '../services/notification.api'
import { useNotificationStore } from '../stores/notification.store'

/** The in-app inbox and the bell's unread count. */
export function useNotifications() {
  const store = useNotificationStore()
  const api = new NotificationApiClient()

  async function refreshUnread() {
    store.setUnread(await api.unread().catch(() => store.unread))
  }

  /** Opening the inbox marks it read. */
  async function openInbox() {
    const inbox = await api.inbox()
    if (inbox.unread) {
      await api.markAllRead()
      store.setUnread(0)
    }
    return inbox
  }

  return { unread: computed(() => store.unread), refreshUnread, openInbox }
}
