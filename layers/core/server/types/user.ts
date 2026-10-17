/** A signed-in person: a MarketX account (Posta has no accounts of its own). */
export interface PostaUser {
  id: string
  email: string
  username?: string
  phone?: string
  role: string
}
