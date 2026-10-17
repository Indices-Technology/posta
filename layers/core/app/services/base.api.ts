/**
 * Base for every API client (MarketX pattern: one `<domain>.api.ts` class per layer).
 *
 * Simpler than MarketX's BaseApiClient because Posta keeps tokens in httpOnly cookies on its
 * own origin: no bearer header, no client-side refresh, no CSRF token to attach.
 *
 * Build one per composable call, never as a module singleton: on the server it carries the
 * visitor's cookies (useRequestFetch), and a shared instance would leak them across requests.
 */
import { ApiError } from './api.error'

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  query?: Record<string, unknown>
}

export class BaseApiClient {
  private fetcher = import.meta.server ? useRequestFetch() : $fetch

  /** Calls a Posta API route and returns its `data` (routes answer { success, data }). */
  protected async request<T>(url: string, opts: RequestOptions = {}): Promise<T> {
    try {
      const res = (await (this.fetcher as (u: string, o: RequestOptions) => Promise<unknown>)(url, opts)) as { data: T }
      return res.data
    } catch (e) {
      const error = ApiError.from(e)
      // Session ended while using the app: back to sign-in, then back here.
      if (error.status === 401 && import.meta.client && !location.pathname.startsWith('/login')) {
        location.href = `/login?next=${encodeURIComponent(location.pathname)}`
      }
      throw error
    }
  }
}
