<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch(`/api/trips/${route.params.id}`)
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Trip not found', fatal: true })
const t = computed(() => data.value!.trip)
useHead({ title: `${t.value.fromCity} to ${t.value.toCity} · Posta` })

const justMatched = Number(route.query.matched ?? -1)
const LEG_STATUS: Record<string, { label: string; tone: Tone }> = {
  ASSIGNED: { label: 'To collect', tone: 'neutral' },
  COLLECTED: { label: 'Carrying', tone: 'ink' },
  HANDED_OVER: { label: 'Handed over', tone: 'ok' },
}
</script>

<template>
  <div v-if="data">
    <NuxtLink to="/trips" class="back"><AppIcon name="back" />Trips</NuxtLink>
    <div class="page-head">
      <div>
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap">
          <h1>{{ t.fromCity }} to {{ t.toCity }}</h1>
          <StatusLabel :status="t.status" kind="trip" />
        </div>
        <p class="sub">{{ t.driverName }} · {{ formatDateTime(t.departAt) }} to {{ formatDateTime(t.arriveBy) }}</p>
      </div>
      <a :href="`tel:${t.driverPhone}`" class="btn quiet small"><AppIcon name="phone" />{{ t.driverPhone }}</a>
    </div>

    <p v-if="justMatched >= 0" class="small soft" style="margin-bottom: 16px">
      Trip posted. {{ justMatched === 0 ? 'No waiting parcels match yet; new ones will be added here.' : `${justMatched} waiting ${justMatched === 1 ? 'parcel was' : 'parcels were'} matched to it.` }}
    </p>

    <section class="section">
      <div class="section-head"><h2>On board</h2><span class="count">{{ data.loads.length }} of {{ t.capacity }}</span></div>
      <ul v-if="data.loads.length" class="rows">
        <li v-for="l in data.loads" :key="l.legId" class="row-static load-row">
          <NuxtLink :to="`/parcels/${l.parcel.id}`">
            <p class="row-title"><span class="figure">{{ formatRef(l.parcel.number) }}</span> {{ l.parcel.description }}</p>
            <p class="row-sub mono">{{ l.fromPostcode }} to {{ l.toPostcode }}</p>
          </NuxtLink>
          <span class="status" :class="`tone-${LEG_STATUS[l.status]!.tone}`"><i class="dot" />{{ LEG_STATUS[l.status]!.label }}</span>
          <CopyLink v-if="l.status !== 'HANDED_OVER'" :path="`/l/${l.linkToken}`" label="Driver link" />
          <span v-else />
        </li>
      </ul>
      <p v-else class="empty">No parcels yet. Parcels from {{ t.fromCity }} to {{ t.toCity }} are added here automatically.</p>
    </section>
  </div>
</template>

<style scoped>
.load-row { --cols: minmax(0, 1fr) 130px auto; }
@media (max-width: 640px) { .load-row { --cols: minmax(0, 1fr) auto; } .load-row > :nth-child(2) { display: none; } }
</style>
