/** The number on the bell. State only (useNotifications does the calls). */
export const useNotificationStore = defineStore('notifications', () => {
  const unread = ref(0)
  const setUnread = (n: number) => {
    unread.value = n
  }
  return { unread, setUnread }
})
