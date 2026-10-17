import { notificationService } from '../../services/notification.service'

// Runs every minute (layers/notifications/nuxt.config.ts): sends anything due, retries failures.
export default defineTask({
  meta: { name: 'notifications:flush', description: 'Send pending notifications and retry failed ones' },
  async run() {
    return { result: await notificationService.flushDue() }
  },
})
