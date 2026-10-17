<script setup lang="ts">
useHead({ title: 'Fulfilment centres · Posta' })
const hubs = useHubs()
const { data } = await useApiData('hubs', () => hubs.list())

const STATUS: Record<string, string> = { PENDING: 'Under review', REJECTED: 'Not approved', SUSPENDED: 'Paused' }
</script>

<template>
  <div v-if="data">
    <div class="row">
      <h1>Fulfilment centres</h1>
      <NuxtLink v-if="data.canEdit" to="/hubs/join" class="btn small ink"><AppIcon name="add" />Add</NuxtLink>
    </div>

    <ul v-if="data.hubs.length" class="list" style="margin-top: 16px">
      <li v-for="h in data.hubs" :key="h.id" class="item">
        <span class="item-icon"><AppIcon name="hubs" /></span>
        <span>
          <b>{{ h.name }}</b>
          <span class="sub">{{ h.city }} · <span class="mono">{{ h.postcode }}</span>{{ h.openingHours ? ` · ${h.openingHours}` : '' }}</span>
          <span v-if="STATUS[h.status]" class="status tone-neutral" style="margin-top: 4px"><i class="dot" />{{ STATUS[h.status] }}</span>
        </span>
        <a :href="`tel:${h.contactPhone}`" class="iconbtn" aria-label="Call"><AppIcon name="phone" /></a>
      </li>
    </ul>
    <p v-else class="empty">None yet.</p>
  </div>
</template>
