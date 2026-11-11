// ponytail: placeholder rate card in kobo, not a pricing decision. Set real numbers before
// turning NUXT_NETWORK_QUOTES on; move to a table when prices change more than once a quarter.
export const NETWORK_RATES = {
  sameCity: { baseMinor: 150_000, perKgOver2Minor: 30_000 },
  intercity: { baseMinor: 350_000, perKgOver2Minor: 50_000 },
  doorMinor: 100_000,
}

/** Posta network price for one parcel. Pure, so it is tested alone. */
export function networkPriceMinor(weightKg: number, intercity: boolean, door: boolean) {
  const r = intercity ? NETWORK_RATES.intercity : NETWORK_RATES.sameCity
  const extraKg = Math.max(0, Math.ceil(weightKg) - 2)
  return r.baseMinor + extraKg * r.perKgOver2Minor + (door ? NETWORK_RATES.doorMinor : 0)
}
