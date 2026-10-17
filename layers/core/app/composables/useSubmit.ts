import { ApiError } from '../services/api.error'

/**
 * Busy / error / field state for any action a person triggers (a form, a confirm button).
 *   const { busy, error, field, run } = useSubmit()
 *   const parcel = await run(() => createParcel(form))   // null if it failed
 */
export function useSubmit() {
  const busy = ref(false)
  const error = ref('')
  const field = ref('')

  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    busy.value = true
    error.value = ''
    field.value = ''
    try {
      return await action()
    } catch (e) {
      const err = ApiError.from(e)
      error.value = err.message
      field.value = err.field ?? ''
      return null
    } finally {
      busy.value = false
    }
  }

  return { busy, error, field, run }
}
