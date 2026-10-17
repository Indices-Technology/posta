import type { PostaUser } from '~~/layers/core/server/types/user'
import { AppError } from '~~/layers/core/server/types/errors'
import { notificationService, to } from '~~/layers/notifications/server/services/notification.service'
import { matchService } from '~~/layers/delivery/server/services/match.service'
import { hubRepository } from '../repositories/hub.repository'
import type { RegisterCentreInput } from '../schemas/hub.schema'
import type { ReviewInput } from '~~/layers/core/server/schemas/common.schema'

export const hubService = {
  /** Everyone sees approved centres; staff see all, with their status. */
  async list(user: PostaUser) {
    const staff = isOps(user)
    return { hubs: staff ? await hubRepository.listAll() : await hubRepository.listApproved(), canEdit: staff }
  },

  /**
   * Register a fulfilment centre. A shop owner's waits for staff approval; one added by staff
   * is live at once (and makes parcels to that city routable straight away).
   */
  async register(user: PostaUser, input: RegisterCentreInput) {
    await assertPostcodesExist({ postcode: input.postcode })
    const staff = isOps(user)
    const hub = await hubRepository.create({
      ...input,
      ownerUserId: user.id,
      status: staff ? 'APPROVED' : 'PENDING',
      ...(staff ? { reviewedBy: user.id, reviewedAt: new Date() } : {}),
    })
    if (staff) await matchService.run()
    else await notificationService.queue([to.staff('staff.application', { what: 'fulfilment centre', name: hub.name, city: hub.city })])
    return { id: hub.id, status: hub.status }
  },

  /** The centres this person registered, with their status. */
  mine(user: PostaUser) {
    return hubRepository.listOwnedBy(user.id)
  },

  async review(user: PostaUser, id: string, { decision }: ReviewInput) {
    requireOps(user)
    const hub = await hubRepository.findById(id)
    if (!hub) throw new AppError('NOT_FOUND', 'Centre not found', 404)
    if (!(await hubRepository.review(id, decision, user.id))) {
      throw new AppError('ALREADY_REVIEWED', 'This application was already decided', 409)
    }
    if (hub.ownerUserId) {
      await notificationService.queue([
        to.user(hub.ownerUserId, 'partner.reviewed', { what: 'fulfilment centre', decision: decision === 'APPROVED' ? 'approved' : 'not approved' }),
      ])
    }
    // A new centre makes parcels to its city routable: match them onto trips right away.
    if (decision === 'APPROVED') await matchService.run()
    return { id, status: decision }
  },
}
