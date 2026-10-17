/**
 * Load a page's data on the server (and on client navigation), and show the error page if it
 * fails: "Parcel not found" becomes a real 404 page instead of a blank screen.
 *   const { data } = await useApiData(`parcel:${id}`, () => delivery.getParcel(id))
 */
export async function useApiData<T>(key: string, load: () => Promise<T>) {
  const result = await useAsyncData(key, load)
  if (result.error.value) {
    const e = result.error.value
    throw createError({ statusCode: e.statusCode || 500, statusMessage: e.statusMessage || e.message, fatal: true })
  }
  return result as typeof result & { data: Ref<T> }
}
