import { randomBytes, randomInt } from 'node:crypto'

/** 6 digits, easy to read out over a counter. Guessing is capped by Leg.failedAttempts. */
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

/** The secret in a carrier's link. */
export const newLinkToken = () => randomBytes(24).toString('base64url')
