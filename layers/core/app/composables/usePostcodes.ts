import { PostcodeApiClient } from '../services/postcode.api'

/** National postcodes from the map (NIPOST, through our server), and the map's search box. */
export function usePostcodes() {
  const api = new PostcodeApiClient()
  return {
    atPoint: (lat: number, lng: number) => api.atPoint(lat, lng),
    search: (q: string, near?: { lat: number; lng: number } | null) => api.search(q, near),
  }
}
