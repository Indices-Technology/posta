/** All database access for notifications. */
import type { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'

type Db = Prisma.TransactionClient

/** In-app rows a person can see: their own, plus the shared staff inbox if they're staff. */
const inboxWhere = (userId: string, staff: boolean): Prisma.NotificationWhereInput => ({
  channel: 'IN_APP',
  OR: [{ toUserId: userId }, ...(staff ? [{ forStaff: true }] : [])],
})

export const notificationRepository = {
  async createMany(rows: Prisma.NotificationCreateManyInput[], db: Db = prisma) {
    if (!rows.length) return []
    return db.notification.createManyAndReturn({ data: rows, select: { id: true, status: true } })
  },

  findById(id: string) {
    return prisma.notification.findUnique({ where: { id } })
  },

  /** Due for a (re)try. */
  listDueIds(now: Date, take: number) {
    return prisma.notification.findMany({
      where: { status: 'PENDING', nextAttemptAt: { lte: now } },
      select: { id: true },
      orderBy: { nextAttemptAt: 'asc' },
      take,
    })
  },

  /**
   * Claim one send attempt. Only one worker wins (attempts must still match), and the row is
   * pushed to its retry time first, so a crash mid-send is retried rather than lost.
   */
  async claim(id: string, attempts: number, retryAt: Date) {
    const { count } = await prisma.notification.updateMany({
      where: { id, status: 'PENDING', attempts },
      data: { attempts: attempts + 1, nextAttemptAt: retryAt },
    })
    return count === 1
  },

  finish(id: string, data: Prisma.NotificationUpdateInput) {
    return prisma.notification.update({ where: { id }, data })
  },

  listInbox(userId: string, staff: boolean, take = 50) {
    return prisma.notification.findMany({
      where: inboxWhere(userId, staff),
      select: { id: true, template: true, params: true, parcelId: true, readAt: true, createdAt: true, forStaff: true },
      orderBy: { createdAt: 'desc' },
      take,
    })
  },

  countUnread(userId: string, staff: boolean) {
    return prisma.notification.count({ where: { ...inboxWhere(userId, staff), readAt: null } })
  },

  // ponytail: staff rows are one shared inbox; one staff member reading marks them read for all.
  markAllRead(userId: string, staff: boolean) {
    return prisma.notification.updateMany({ where: { ...inboxWhere(userId, staff), readAt: null }, data: { readAt: new Date() } })
  },
}
