<script setup lang="ts">
useHead({ title: 'Parcels · Posta' })
const route = useRoute()
const view = computed(() => (route.query.view as string) || 'all')
const { data } = await useFetch('/api/parcels', { query: { view } })

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'moving', label: 'Moving' },
  { key: 'delivered', label: 'Delivered' },
] as const
</script>

<template>
  <div>
    <div class="page-head">
      <h1>Parcels</h1>
      <NuxtLink to="/parcels/new" class="btn"><AppIcon name="add" />Book a parcel</NuxtLink>
    </div>

    <nav class="tabs" aria-label="Filter parcels">
      <NuxtLink
        v-for="t in tabs"
        :key="t.key"
        :to="t.key === 'all' ? '/parcels' : `/parcels?view=${t.key}`"
        :class="{ on: view === t.key }"
      >
        {{ t.label }}<span class="c">{{ data?.counts[t.key] ?? 0 }}</span>
      </NuxtLink>
    </nav>

    <ul v-if="data?.parcels.length" class="rows">
      <li v-for="p in data.parcels" :key="p.id">
        <NuxtLink :to="`/parcels/${p.id}`" class="row-link parcel-row">
          <div style="min-width: 0">
            <p class="row-title"><span class="figure">{{ formatRef(p.number) }}</span> {{ p.description }}</p>
            <p class="row-sub">To {{ p.recipientName }}</p>
          </div>
          <p class="route soft small">{{ p.fromCity }} <AppIcon name="arrow" class="faint" /> {{ p.toCity }}</p>
          <StatusLabel :status="p.status" />
        </NuxtLink>
      </li>
    </ul>
    <div v-else class="empty">
      <p>{{ view === 'all' ? 'No parcels yet.' : 'Nothing here right now.' }}</p>
      <NuxtLink v-if="view === 'all'" to="/parcels/new" class="btn ink"><AppIcon name="add" />Book the first parcel</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.parcel-row { --cols: minmax(0, 1fr) 170px 170px; }
.row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.route { display: flex; align-items: center; gap: 6px; }
@media (max-width: 640px) {
  .parcel-row { --cols: minmax(0, 1fr) auto; }
  .route { display: none; }
}
</style>
