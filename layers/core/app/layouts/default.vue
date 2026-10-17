<script setup lang="ts">
const { displayName, isOps, logout } = useAuth()
const open = ref(false)
watch(() => useRoute().fullPath, () => (open.value = false))
</script>

<template>
  <div class="wrap" :class="{ wide: $route.meta.wide }">
    <header class="top">
      <NuxtLink to="/" class="wordmark">posta<span>.</span></NuxtLink>
      <div class="row" style="gap: 4px">
        <NotificationBell />
        <button class="avatar" :aria-expanded="open" aria-label="Account" @click="open = !open">{{ displayName.charAt(0) }}</button>
      </div>
      <nav v-if="open" class="menu">
        <p class="small faint" style="padding: 8px 12px">{{ displayName }}</p>
        <NuxtLink to="/join"><AppIcon name="work" />Work with Posta</NuxtLink>
        <NuxtLink v-if="isOps" to="/admin"><AppIcon name="staff" />Staff</NuxtLink>
        <NuxtLink v-if="isOps" to="/hubs"><AppIcon name="hubs" />Fulfilment centres</NuxtLink>
        <button @click="logout"><AppIcon name="signout" />Sign out</button>
      </nav>
    </header>
    <main class="page"><slot /></main>
  </div>
</template>
