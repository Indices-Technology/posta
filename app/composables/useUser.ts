export interface PostaUser {
  id: string
  email: string
  username?: string
  role: string
}

/** The signed-in MarketX user. Filled during server render by server/middleware/session.ts. */
export const useUser = () =>
  useState<PostaUser | null>('user', () =>
    import.meta.server ? (useRequestEvent()?.context.user ?? null) : null,
  )
