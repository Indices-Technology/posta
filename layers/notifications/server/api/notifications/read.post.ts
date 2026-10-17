// POST /api/notifications/read — mark my inbox as read.
import { notificationService } from '../../services/notification.service'

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  return notificationService.markAllRead(user.id, isOps(user))
})
