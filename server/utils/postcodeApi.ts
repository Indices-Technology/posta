/**
 * The national postcode API (api.postcode.gov.ng). Lookup level 1 (is it real?) is free.
 *
 * Only a LIVE key checks real postcodes: test keys resolve 5 sandbox buildings in the FCT and
 * nothing else, so with a test key every Jos or Lagos postcode would look invalid. Without a
 * live key Posta checks the shape only.
 */
export async function postcodeExists(canonical: string): Promise<boolean | null> {
  const key = useRuntimeConfig().postcodeApiKey
  if (!key.startsWith('nipost_live_')) return null

  try {
    const res = await $fetch<{ data: { valid: boolean } }>('https://api.postcode.gov.ng/v1/lookup', {
      query: { code: canonical, level: 1 },
      headers: { 'X-API-Key': key },
      timeout: 4000,
    })
    return res.data.valid
  } catch (err) {
    // The registry being down or rate-limiting must not stop a parcel being booked.
    console.warn('[postcode] lookup failed', (err as Error).message)
    return null
  }
}

/** Reject postcodes the registry says don't exist. Unknown (no key, API down) passes. */
export async function assertPostcodesExist(fields: Record<string, string>) {
  for (const [field, code] of Object.entries(fields)) {
    if ((await postcodeExists(code)) === false) {
      throw createError({ statusCode: 400, statusMessage: `${code} is not a registered postcode`, data: { field } })
    }
  }
}
