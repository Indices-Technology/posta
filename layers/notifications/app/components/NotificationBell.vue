<script setup lang="ts">
// The bell in the header. Checks for new messages on load and every minute while the tab is open.
const { unread, refreshUnread } = useNotifications()

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  refreshUnread()
  timer = setInterval(() => document.visibilityState === 'visible' && refreshUnread(), 60_000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <NuxtLink to="/notifications" class="iconbtn bell" :aria-label="unread ? `${unread} new messages` : 'Messages'">
    <AppIcon name="bell" />
    <i v-if="unread" class="badge">{{ unread > 9 ? '9+' : unread }}</i>
  </NuxtLink>
</template>

<style scoped>
.bell { position: relative; }
.badge {
  position: absolute; top: 6px; right: 4px; min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 999px; background: var(--coral); color: #fff; font: 800 11px/18px var(--font-body); font-style: normal; text-align: center;
}
</style>
