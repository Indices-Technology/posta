import { DeliveryApiClient } from '../services/delivery.api'

/**
 * Scans: the only way stakeholders talk to each other. Read a scanned handover, confirm it (by QR
 * or by typing its 6-digit code). `job` is a carrier's job link, for carriers without an account.
 */
export function useHandovers() {
  const api = new DeliveryApiClient()
  return {
    view: (token: string, job?: string | null) => api.getHandover(token, job),
    confirm: (token: string, job?: string | null) => api.confirmHandover(token, job),
    confirmCode: (code: string, job?: string | null) => api.confirmCode(code, job),
  }
}

/** The QR content for a handover: a normal link, so any phone camera can open it too. */
export const handoverUrl = (token: string) => `${import.meta.client ? location.origin : ''}/h/${token}`

/** Pull the handover token out of whatever a scanner read (our link, or a bare token). */
export function tokenFromScan(text: string): string | null {
  const m = text.trim().match(/\/h\/([a-f0-9]{16,64})(?:[?#].*)?$/i) ?? text.trim().match(/^([a-f0-9]{16,64})$/i)
  return m ? m[1]!.toLowerCase() : null
}
