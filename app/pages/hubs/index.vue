<script setup lang="ts">
useHead({ title: 'Handover points · Posta' })
const { data, refresh } = await useFetch('/api/hubs')

const adding = ref(false)
const f = reactive({ name: '', postcode: '', city: '', lat: '', lng: '', contactPhone: '' })
const { busy, error, field, submit } = useForm<{ id: string }>('/api/hubs')
const bad = (name: string) => field.value === name

async function add() {
  if (await submit({ ...f })) {
    Object.assign(f, { name: '', postcode: '', city: '', lat: '', lng: '', contactPhone: '' })
    adding.value = false
    await refresh()
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Handover points</h1>
        <p class="sub">Partner shops where drivers hand parcels to couriers.</p>
      </div>
      <button v-if="data?.canEdit && !adding" class="btn" @click="adding = true"><AppIcon name="add" />Add a point</button>
    </div>

    <form v-if="adding" class="panel section" novalidate @submit.prevent="add">
      <h2 style="margin-bottom: 16px">New handover point</h2>
      <div class="fields">
        <label class="field"><span>Name</span><input v-model="f.name" class="input" :class="{ bad: bad('name') }" placeholder="Ikeja Along Partner Shop" /></label>
        <label class="field"><span>Phone</span><input v-model="f.contactPhone" class="input" :class="{ bad: bad('contactPhone') }" type="tel" inputmode="tel" /></label>
        <label class="field"><span>Postcode</span><PostcodeInput v-model="f.postcode" :bad="bad('postcode')" /></label>
        <label class="field"><span>City</span><input v-model="f.city" class="input" :class="{ bad: bad('city') }" /></label>
        <label class="field">
          <span>Latitude</span><input v-model="f.lat" class="input" :class="{ bad: bad('lat') }" inputmode="decimal" placeholder="6.6018" />
        </label>
        <label class="field">
          <span>Longitude</span><input v-model="f.lng" class="input" :class="{ bad: bad('lng') }" inputmode="decimal" placeholder="3.3515" />
          <span class="hint">In Google Maps, right-click the shop and copy the numbers</span>
        </label>
      </div>
      <div class="form-actions" style="margin-top: 20px">
        <p v-if="error" class="form-error" role="alert"><AppIcon name="alert" />{{ error }}</p>
        <button type="button" class="btn quiet" @click="adding = false">Cancel</button>
        <button class="btn ink" :disabled="busy">{{ busy ? 'Saving…' : 'Save point' }}</button>
      </div>
    </form>

    <ul v-if="data?.hubs.length" class="rows">
      <li v-for="h in data.hubs" :key="h.id" class="row-static hub-row">
        <div>
          <p class="row-title">{{ h.name }}</p>
          <p class="row-sub">{{ h.city }}</p>
        </div>
        <p class="mono">{{ h.postcode }}</p>
        <a :href="`tel:${h.contactPhone}`" class="soft small">{{ h.contactPhone }}</a>
      </li>
    </ul>
    <p v-else class="empty">No handover points yet. Parcels need one in their destination city.</p>
  </div>
</template>

<style scoped>
.hub-row { --cols: minmax(0, 1fr) 180px 150px; }
@media (max-width: 640px) { .hub-row { --cols: minmax(0, 1fr) auto; } .hub-row > :last-child { display: none; } }
</style>
