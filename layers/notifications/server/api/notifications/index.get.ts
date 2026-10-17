// GET /api/notifications — my in-app inbox (plus the shared staff inbox for staff).
import { notificationService } from '../../services/notification.service'

export default defineApiHandler(async (event) => {
  const user = await requireUser(event)
  return notificationService.inbox(user.id, isOps(user))
})
