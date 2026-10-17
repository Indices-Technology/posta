/** A failed API call, with the server's message (already written for people) and the field at fault. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public field?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  // The names Nuxt's error page reads, so a 404 from the API renders as a 404 page.
  get statusCode() {
    return this.status
  }
  get statusMessage() {
    return this.message
  }

  static from(e: unknown): ApiError {
    if (e instanceof ApiError) return e
    const err = e as { statusCode?: number; status?: number; data?: any }
    const status = err?.statusCode ?? err?.status ?? 0
    if (!status) return new ApiError(0, 'Check your connection and try again.', 'NETWORK')
    return new ApiError(
      status,
      err.data?.statusMessage || err.data?.message || 'Something went wrong. Try again.',
      err.data?.data?.code,
      err.data?.data?.field,
    )
  }
}
