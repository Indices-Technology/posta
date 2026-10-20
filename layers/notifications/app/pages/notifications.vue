<script setup lang="ts">
import type { IconName } from '~~/layers/core/app/components/AppIcon.vue'
useHead({ title: 'Messages' })
const { openInbox } = useNotifications()
const { data } = await useApiData('inbox', () => openInbox())
const NuxtLink = resolveComponent('NuxtLink')
</script>

<template>
  <div v-if="data">
    <h1>Messages</h1>
    <ul v-if="data.items.length" class="list" style="margin-top: 16px">
      <li v-for="n in data.items" :key="n.id">
        <component :is="n.parcelId ? NuxtLink : 'div'" :to="n.parcelId ? `/parcels/${n.parcelId}` : undefined" class="item">
          <span class="item-icon" :class="{ 'tone-alert': n.forStaff }"><AppIcon :name="n.icon as IconName" /></span>
          <span>
            <b :style="{ fontWeight: n.read ? 600 : 800 }">{{ n.text }}</b>
            <span class="sub">{{ formatDateTime(n.at) }}{{ n.forStaff ? ' · Staff' : '' }}</span>
          </span>
          <AppIcon v-if="n.parcelId" name="chevron" />
          <span v-else />
        </component>
      </li>
    </ul>
    <section v-else class="panel" style="margin-top: 20px; text-align: center">
      <div class="hero-icon" style="margin-inline: auto"><AppIcon name="bell" /></div>
      <h2>Nothing yet</h2>
      <p class="soft" style="margin-top: 6px">Updates about your parcels and trips land here.</p>
    </section>
  </div>
</template>
