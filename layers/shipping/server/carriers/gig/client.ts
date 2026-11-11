/**
 * GIG Logistics API client (sandbox/prod).
 *
 * Docs: https://gig-logistics.readme.io/
 *   - POST /login                     → { ... data.data["access-token"] }  (JWT)
 *   - GET  /localstations/get         → data.data[] of stations (StationId, StateName, ...)
 *   - POST /price                     → data.data { GrandTotal, DeliverPrice, ... }
 *   - POST /capture/preshipment       → data.data { Waybill }
 *   - GET  /track/mobileShipment      → data[] { MobileShipmentTrackings[] }
 *
 * Auth: login once, send the JWT in an `access-token` header on every call.
 * Token + station list are cached in-memory and refreshed on expiry/401.
 *
 * Config (env): GIG_BASE_URL, GIG_EMAIL, GIG_PASSWORD, GIG_CUSTOMER_CODE,
 * GIG_CUSTOMER_TYPE. When email/password/customerCode are absent the provider
 * falls back to the static rate card.
 */

const SANDBOX = 'https://dev-thirdpartynode.theagilitysystems.com'

interface GigConfig {
  baseUrl: string
  email: string
  password: string
  customerCode: string
  customerType: number
}

export function gigConfig(): GigConfig {
  return {
    baseUrl: process.env.GIG_BASE_URL || SANDBOX,
    email: process.env.GIG_EMAIL || '',
    password: process.env.GIG_PASSWORD || '',
    customerCode: process.env.GIG_CUSTOMER_CODE || '',
    customerType: Number(process.env.GIG_CUSTOMER_TYPE ?? 0),
  }
}

/**
 * Posta's kill-switch for GIG. Off unless GIG_ENABLED=true. Read from process.env
 * directly because this module is imported outside a request context.
 *
 * While off, GIG is never quoted or booked. Clients add their own gate on top: MarketX
 * only lists 'gig' in `carriers` for sellers who opted in.
 *
 * NOTE: this gate says nothing about WHICH GIG environment is in use. Sandbox vs
 * production is purely GIG_BASE_URL + credentials — the sandbox host issues
 * waybills that are not real shipments, so never open this gate in production
 * while GIG_BASE_URL still points at dev-thirdpartynode.
 */
export function isGigEnabled(): boolean {
  return process.env.GIG_ENABLED === 'true'
}

/** Only email + password are required — CustomerCode/Type are derived from login. */
export function hasGigCredentials(): boolean {
  const c = gigConfig()
  return Boolean(c.email && c.password)
}

/**
 * Usable right now: credentials present AND the platform switch on. Every GIG
 * quote/book path already gates on this, so the switch closes all of them at
 * once — including any path added later that follows the same convention.
 */
export function isGigConfigured(): boolean {
  return isGigEnabled() && hasGigCredentials()
}

// Customer code/type derived from the login response (UserChannelCode / CustomerType),
// overridable by env. The /price + /capture calls require these.
let derived: { customerCode?: string; customerType?: number } = {}

export function gigCustomerCode(): string {
  // Ignore unset/placeholder env values (e.g. "<your code>") — prefer the
  // value derived from the login response.
  const env = gigConfig().customerCode
  const valid = env && !env.includes('<') ? env : ''
  return valid || derived.customerCode || ''
}

export function gigCustomerType(): number {
  const n = parseInt(process.env.GIG_CUSTOMER_TYPE ?? '', 10)
  if (Number.isFinite(n)) return n
  return derived.customerType ?? 0
}

// ── token cache ───────────────────────────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null
const TOKEN_TTL_MS = 50 * 60 * 1000 // refresh well before a typical 1h JWT expiry

async function login(): Promise<string> {
  const c = gigConfig()
  const res = await fetch(`${c.baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: c.email, password: c.password }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`GIG login failed: ${res.status}`)
  const body: any = await res.json()
  // Real sandbox shape: token at data["access-token"]; the docs showed a doubled
  // data.data — handle both.
  const userData = body?.data?.data ?? body?.data ?? body
  const token = userData?.['access-token'] ?? body?.['access-token']
  if (!token) throw new Error('GIG login: access-token not found in response')
  // Derive the customer code/type for /price + /capture from the login payload.
  derived = {
    customerCode:
      userData?.UserChannelCode || userData?.UserName || derived.customerCode,
    customerType:
      typeof userData?.CustomerType === 'number'
        ? userData.CustomerType
        : derived.customerType,
  }
  cachedToken = { token, expiresAt: Date.now() + TOKEN_TTL_MS }
  return token
}

async function getToken(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }
  return login()
}

/** Authenticated GIG request with one automatic re-login on 401. */
async function gigFetch<T = any>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const c = gigConfig()
  const token = await getToken()
  const res = await fetch(`${c.baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'access-token': token,
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(15000),
  })
  // Re-login only on a genuine auth failure (not business 401s like a bad id).
  if (res.status === 401 && retry) {
    const peek = await res.clone().text()
    if (/token|unauthor|expired|jwt/i.test(peek)) {
      cachedToken = null
      await getToken(true)
      return gigFetch<T>(path, init, false)
    }
    throw new Error(`GIG ${path} failed: 401 ${peek.slice(0, 200)}`)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GIG ${path} failed: ${res.status} ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ── stations cache ──────────────────────────────────────────────────────────
export interface GigStation {
  StationId: number
  StationName: string
  StateName: string
  StationCode?: string
  StateId?: number
  IsDeleted?: boolean
  IsPublic?: boolean
}

let cachedStations: { stations: GigStation[]; expiresAt: number } | null = null
const STATIONS_TTL_MS = 24 * 60 * 60 * 1000 // stations change rarely

export async function getStations(): Promise<GigStation[]> {
  if (cachedStations && cachedStations.expiresAt > Date.now()) {
    return cachedStations.stations
  }
  const body: any = await gigFetch('/localstations/get', { method: 'GET' })
  const stations: GigStation[] = body?.data?.data ?? body?.data ?? []
  cachedStations = { stations, expiresAt: Date.now() + STATIONS_TTL_MS }
  return stations
}

// ── service centres (for drop-off DestinationServiceCenterId) ─────────────────
export interface GigServiceCentre {
  StationId: number
  StationName: string
  ServiceCentreId: number
  ServiceCentreName: string
  ServiceCentreCode: string
  Latitude?: number
  Longitude?: number
  Address?: string
}

// Keyed by StationId — service centres change rarely, cache per station for a day.
const cachedCentres = new Map<
  number,
  { centres: GigServiceCentre[]; expiresAt: number }
>()

/** Service centres for a station (`/serviceCentresByStation`). Used to resolve the
 *  DestinationServiceCenterId that /create/dropOff requires, and to show the seller
 *  which centre to drop at. */
export async function getServiceCentres(
  stationId: number,
): Promise<GigServiceCentre[]> {
  const hit = cachedCentres.get(stationId)
  if (hit && hit.expiresAt > Date.now()) return hit.centres
  const body: any = await gigFetch(
    `/serviceCentresByStation?StationId=${stationId}`,
    { method: 'GET' },
  )
  const centres: GigServiceCentre[] = body?.data?.data ?? body?.data ?? []
  cachedCentres.set(stationId, {
    centres,
    expiresAt: Date.now() + STATIONS_TTL_MS,
  })
  return centres
}

// ── operations ────────────────────────────────────────────────────────────────
export interface GigPriceResult {
  GrandTotal?: number
  DeliverPrice?: number
  MainCharge?: number
  PickupCharge?: number
  InsuranceValue?: number
  Discount?: number
}

export async function fetchPrice(
  payload: Record<string, unknown>,
): Promise<GigPriceResult> {
  const body: any = await gigFetch('/price', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return (body?.data?.data ?? body?.data ?? {}) as GigPriceResult
}

/**
 * Drop-off price — the seller brings the parcel to a GIG service centre (no
 * pickup charge, but a different delivery-price model). Separate endpoint from
 * `/price`; the two are priced independently and neither is reliably cheaper, so
 * callers quote both and charge the higher. Request needs only the station pair
 * + DeliveryType (0 = standard) + PickUpOptions; no CustomerCode/locations.
 */
export async function fetchDropoffPrice(
  payload: Record<string, unknown>,
): Promise<GigPriceResult> {
  const body: any = await gigFetch('/dropOff/price', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return (body?.data?.data ?? body?.data ?? {}) as GigPriceResult
}

export async function capturePreshipment(
  payload: Record<string, unknown>,
): Promise<{ Waybill?: string }> {
  const body: any = await gigFetch('/capture/preshipment', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return (body?.data?.data ?? body?.data ?? {}) as { Waybill?: string }
}

/**
 * Create a DROP-OFF shipment (`/create/dropOff`) — the seller takes the parcel to
 * a GIG service centre themselves (no rider pickup). Unlike `/capture/preshipment`
 * this returns a **TempCode** (e.g. "PRE000568-APH"), NOT a Waybill: the TempCode
 * becomes a real Waybill only once the seller drops the parcel and GIG accepts it
 * at the counter. That acceptance is our authoritative "GIG now has the parcel"
 * signal — see the booking/tracking layer. Note GIG uses `PickupOptions` here
 * (not `PickUpOptions` as on `/price`).
 */
export async function captureDropoff(
  payload: Record<string, unknown>,
): Promise<{ TempCode?: string }> {
  const body: any = await gigFetch('/create/dropOff', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return (body?.data?.data ?? body?.data ?? {}) as { TempCode?: string }
}

export async function trackShipment(waybill: string): Promise<any[]> {
  const body: any = await gigFetch(
    `/track/mobileShipment?Waybill=${encodeURIComponent(waybill)}&fetchOption=1`,
    { method: 'GET' },
  )
  return (body?.data ?? []) as any[]
}
