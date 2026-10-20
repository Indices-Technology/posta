import { PostcodeApiClient } from '../services/postcode.api'

/** National postcodes from the map (NIPOST, through our server). */
export function usePostcodes() {
  const api = new PostcodeApiClient()
  return { atPoint: (lat: number, lng: number) => api.atPoint(lat, lng) }
}
