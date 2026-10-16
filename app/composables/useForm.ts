/** Submit a form to the API and keep the server's first error, tied to its field. */
export function useForm<T>(url: string) {
  const busy = ref(false)
  const error = ref('')
  const field = ref('')

  async function submit(body: Record<string, unknown>): Promise<T | null> {
    busy.value = true
    error.value = ''
    field.value = ''
    try {
      return (await $fetch(url, { method: 'POST', body })) as T
    } catch (e: any) {
      error.value = e?.data?.statusMessage || 'Something went wrong. Try again.'
      field.value = e?.data?.data?.field || ''
      return null
    } finally {
      busy.value = false
    }
  }
  return { busy, error, field, submit }
}
