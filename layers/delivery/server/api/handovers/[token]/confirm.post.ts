// POST /api/handovers/:token/confirm — the taker confirms the handover after scanning the QR.
import { z } from 'zod'
import { handoverService } from '../../../services/handover.service'

const body = z.object({ job: z.string().optional().nullable() })

export default defineApiHandler(async (event) => {
  const { job } = body.parse((await readBody(event).catch(() => ({}))) ?? {})
  return handoverService.confirmToken(getRouterParam(event, 'token')!, { user: await getUser(event), job })
})
