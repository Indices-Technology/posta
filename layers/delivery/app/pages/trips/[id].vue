<script setup lang="ts">
import type { IconName } from '~~/layers/core/app/components/AppIcon.vue'
// The traveller's view of their own trip: which parcels to collect, one big button each.
const id = useRoute().params.id as string
const delivery = useDelivery()
const { data } = await useApiData(`trip:${id}`, () => delivery.getTrip(id))
const t = computed(() => data.value!.trip)
useHead({ title: `${t.value.fromCity} → ${t.value.toCity}` })

const LEG: Record<string, { label: string; icon: IconName; ok?: boolean }> = {
  ASSIGNED: { label: 'To collect', icon: 'parcel' },
  COLLECTED: { label: 'With you', icon: 'road' },
  HANDED_OVER: { label: 'Handed over', icon: 'done', ok: true },
}
</script>

<template>
  <div v-if="data">
    <BackButton style="margin-left: -12px" />
    <h1 style="margin-top: 8px">{{ t.fromCity }} → {{ t.toCity }}</h1>
    <p class="soft" style="margin-top: 6px">{{ formatDateTime(t.departAt) }} · {{ data.loads.length }} of {{ t.capacity }} parcels</p>

    <ul v-if="data.loads.length" class="list" style="margin-top: 20px">
      <li v-for="l in data.loads" :key="l.legId">
        <div class="item">
          <span class="item-icon" :class="{ ok: LEG[l.status]?.ok }"><AppIcon :name="LEG[l.status]!.icon" /></span>
          <span>
            <b>{{ l.parcel.description }}</b>
            <span class="sub">{{ LEG[l.status]!.label }} · {{ l.parcel.weightKg }} kg</span>
          </span>
          <NuxtLink v-if="l.status !== 'HANDED_OVER'" :to="`/l/${l.linkToken}`" class="btn small ink">Open</NuxtLink>
        </div>
      </li>
    </ul>

    <section v-else class="panel" style="margin-top: 20px">
      <div class="hero-icon"><AppIcon name="waiting" /></div>
      <h2>No parcels yet</h2>
      <p class="soft" style="margin-top: 6px">Parcels going to {{ t.toCity }} land here.</p>
    </section>
  </div>
</template>
