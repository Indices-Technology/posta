<script setup lang="ts">
const user = useUser()
const route = useRoute()

const nav = [
  { to: '/', label: 'Overview', short: 'Overview', icon: 'overview' },
  { to: '/parcels', label: 'Parcels', short: 'Parcels', icon: 'parcels' },
  { to: '/trips', label: 'Trips', short: 'Trips', icon: 'trips' },
  { to: '/hubs', label: 'Handover points', short: 'Points', icon: 'hubs' },
] as const

const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
const who = computed(() => user.value?.username || user.value?.email || '')

async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  user.value = null
  await navigateTo('/login')
}
</script>

<template>
  <div class="shell">
    <nav class="sidenav" aria-label="Main">
      <NuxtLink to="/" class="wordmark">posta<span>.</span></NuxtLink>
      <NuxtLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="navlink"
        active-class=""
        exact-active-class=""
        :class="{ 'router-link-active': isActive(item.to) }"
      >
        <AppIcon :name="item.icon" />{{ item.label }}
      </NuxtLink>
      <div class="me">
        <span class="avatar">{{ who.charAt(0) }}</span>
        <div class="who">
          <p class="small" style="font-weight: 700">{{ who }}</p>
          <p class="small faint">MarketX account</p>
        </div>
        <button class="iconbtn" title="Sign out" @click="signOut"><AppIcon name="signout" label="Sign out" /></button>
      </div>
    </nav>

    <header class="topbar">
      <NuxtLink to="/" class="wordmark">posta<span>.</span></NuxtLink>
      <button class="iconbtn" title="Sign out" @click="signOut"><AppIcon name="signout" label="Sign out" /></button>
    </header>

    <main class="main">
      <div class="main-inner"><slot /></div>
    </main>

    <nav class="bottomnav" aria-label="Main">
      <NuxtLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        active-class=""
        exact-active-class=""
        :class="{ 'router-link-active': isActive(item.to) }"
      >
        <AppIcon :name="item.icon" />{{ item.short }}
      </NuxtLink>
    </nav>
  </div>
</template>
