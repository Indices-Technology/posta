import { z } from 'zod'
import { applyLegAction } from '../../services/leg.service'

const body = z.object({
  action: z.enum(['collect', 'handover']),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

// ponytail: support line is a constant until Posta has a real number
const SUPPORT = '0800 000 0000'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')!
  const { action, code } = await parseBody(event, body)
  const { plan } = await applyLegAction(token, action, code)

  if (!plan.ok) {
    const statusMessage =
      plan.reason === 'locked'
        ? `This job is locked after too many wrong codes. Call Posta on ${SUPPORT}.`
        : plan.reason === 'already_done'
          ? 'This step is already done.'
          : plan.reason === 'not_yet'
            ? 'Collect the parcel first.'
          : plan.attemptsLeft === 0
            ? `That code is not right. This job is now locked. Call Posta on ${SUPPORT}.`
            : `That code is not right. ${plan.attemptsLeft} ${plan.attemptsLeft === 1 ? 'try' : 'tries'} left.`
    throw createError({ statusCode: 422, statusMessage })
  }
  return loadLegView(token)
})
