import type { z } from 'zod'
import type { H3Event } from 'h3'
import type { MarketxUser } from './marketx'

/** Posta staff: MarketX admins and support agents see every parcel and every code. */
export const isOps = (u: MarketxUser) => u.role === 'admin' || u.role === 'support_agent'

/** Everyone else sees what they created. */
export const ownedBy = (u: MarketxUser) => (isOps(u) ? {} : { createdBy: u.id })

export function requireOps(u: MarketxUser) {
  if (!isOps(u)) throw createError({ statusCode: 403, statusMessage: 'Only Posta staff can do this' })
}

/** Validate a body and report the first problem in words a person can act on. */
export async function parseBody<S extends z.ZodTypeAny>(event: H3Event, schema: S): Promise<z.infer<S>> {
  const result = schema.safeParse(await readBody(event).catch(() => ({})))
  if (!result.success) {
    const issue = result.error.issues[0]!
    throw createError({ statusCode: 400, statusMessage: issue.message, data: { field: issue.path.join('.') } })
  }
  return result.data
}
