// GET /api/notifications/unread — the number on the bell.
import { notificationService } from '../../services/notification.service'

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  return notificationService.unreadCount(user.id, isOps(user))
})
