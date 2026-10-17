/** Waits between send attempts: 1 min, 5 min, 15 min, 1 hour, then give up. */
export const RETRY_DELAYS_MIN = [1, 5, 15, 60] as const
export const MAX_ATTEMPTS = RETRY_DELAYS_MIN.length + 1

/**
 * When to try again after `attempt` (1-based) fails, or null to give up.
 * The claim also uses this: a send that crashes mid-way is retried after the same wait.
 */
export function nextAttemptAt(attempt: number, now = new Date()): Date | null {
  const wait = RETRY_DELAYS_MIN[attempt - 1]
  return wait === undefined ? null : new Date(now.getTime() + wait * 60_000)
}
