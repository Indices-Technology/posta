// POST /api/handovers/code — confirm by typing the 6-digit code from the other person's screen.
import { z } from 'zod'
import { handoverService } from '../../services/handover.service'

const body = z.object({
  code: z.string({ required_error: 'Enter the 6-digit code' }).trim().regex(/^\d{3}\s?\d{3}$/, 'Enter the 6-digit code'),
  job: z.string().optional().nullable(),
})

export default defineApiHandler(async (event) => {
  const { code, job } = body.parse(await readBody(event))
  const user = await getUser(event)
  // On top of the per-handover lock: nobody gets to try codes in bulk.
  rateLimit(`code:${user?.id ?? job ?? getRequestIP(event, { xForwardedFor: true })}`, 10, 60_000)
  return handoverService.confirmCode(code.replace(/\s/g, ''), { user, job })
})
