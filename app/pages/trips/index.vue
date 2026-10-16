<script setup lang="ts">
useHead({ title: 'Trips · Posta' })
const { data } = await useFetch('/api/trips')
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Trips</h1>
        <p class="sub">Journeys people are already making. Parcels going the same way ride along.</p>
      </div>
      <NuxtLink to="/trips/new" class="btn"><AppIcon name="add" />Post a trip</NuxtLink>
    </div>

    <ul v-if="data?.trips.length" class="rows">
      <li v-for="t in data.trips" :key="t.id">
        <NuxtLink :to="`/trips/${t.id}`" class="row-link trip-row">
          <div>
            <p class="row-title">{{ t.fromCity }} to {{ t.toCity }}</p>
            <p class="row-sub">{{ t.driverName }} · leaves {{ formatDateTime(t.departAt) }}</p>
          </div>
          <div class="load">
            <p class="small"><span class="figure">{{ t.carrying }}</span> of {{ t.capacity }} parcels</p>
            <div class="progress" :class="{ ok: t.status === 'DONE' }"><i :style="{ width: `${Math.min(100, (t.carrying / t.capacity) * 100)}%` }" /></div>
          </div>
          <StatusLabel :status="t.status" kind="trip" />
        </NuxtLink>
      </li>
    </ul>
    <div v-else class="empty">
      <p>No trips yet.</p>
      <NuxtLink to="/trips/new" class="btn ink"><AppIcon name="add" />Post the first trip</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.trip-row { --cols: minmax(0, 1fr) 160px 140px; }
.load { display: grid; gap: 6px; }
@media (max-width: 640px) {
  .trip-row { --cols: minmax(0, 1fr) auto; }
  .load { display: none; }
}
</style>
