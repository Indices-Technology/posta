<script setup lang="ts">
useHead({ title: 'Post a trip · Posta' })
const { data: hubData } = await useFetch('/api/hubs')
const cities = computed(() => [...new Set(hubData.value?.hubs.map((h) => h.city) ?? [])])

const f = reactive({ driverName: '', driverPhone: '', fromCity: '', toCity: '', departAt: '', arriveBy: '', capacity: '3' })
const { busy, error, field, submit } = useForm<{ id: string; matched: number }>('/api/trips')

// datetime-local has no timezone; the browser's clock decides, which is the person's own.
const iso = (local: string) => (local ? new Date(local).toISOString() : '')

async function post() {
  const res = await submit({ ...f, departAt: iso(f.departAt), arriveBy: iso(f.arriveBy) })
  if (res) await navigateTo({ path: `/trips/${res.id}`, query: { matched: res.matched } })
}
const bad = (name: string) => field.value === name
</script>

<template>
  <div>
    <NuxtLink to="/trips" class="back"><AppIcon name="back" />Trips</NuxtLink>
    <div class="page-head">
      <div>
        <h1>Post a trip</h1>
        <p class="sub">Waiting parcels going the same way are matched as soon as you post.</p>
      </div>
    </div>

    <form novalidate @submit.prevent="post">
      <section class="form-section">
        <div class="about">
          <h2>Driver</h2>
          <p>They get a link for each parcel. No app or account needed.</p>
        </div>
        <div class="fields">
          <label class="field"><span>Name</span><input v-model="f.driverName" class="input" :class="{ bad: bad('driverName') }" /></label>
          <label class="field"><span>Phone</span><input v-model="f.driverPhone" class="input" :class="{ bad: bad('driverPhone') }" type="tel" inputmode="tel" placeholder="0803 000 0000" /></label>
        </div>
      </section>

      <section class="form-section">
        <div class="about">
          <h2>Route</h2>
          <p>Parcels are handed over at a Posta point in the destination city.</p>
        </div>
        <div class="fields">
          <label class="field"><span>From</span><input v-model="f.fromCity" class="input" :class="{ bad: bad('fromCity') }" list="trip-cities" placeholder="Jos" /></label>
          <label class="field"><span>To</span><input v-model="f.toCity" class="input" :class="{ bad: bad('toCity') }" list="trip-cities" placeholder="Lagos" /></label>
          <label class="field"><span>Leaves</span><input v-model="f.departAt" class="input" :class="{ bad: bad('departAt') }" type="datetime-local" /></label>
          <label class="field"><span>Arrives by</span><input v-model="f.arriveBy" class="input" :class="{ bad: bad('arriveBy') }" type="datetime-local" /></label>
        </div>
      </section>

      <section class="form-section">
        <div class="about">
          <h2>Room</h2>
          <p>How many parcels fit without crowding the car.</p>
        </div>
        <div class="fields">
          <label class="field"><span>Parcels</span><input v-model="f.capacity" class="input" :class="{ bad: bad('capacity') }" type="number" min="1" max="20" inputmode="numeric" /></label>
        </div>
      </section>

      <div class="form-actions">
        <p v-if="error" class="form-error" role="alert"><AppIcon name="alert" />{{ error }}</p>
        <NuxtLink to="/trips" class="btn quiet">Cancel</NuxtLink>
        <button class="btn" :disabled="busy">{{ busy ? 'Posting…' : 'Post trip' }}</button>
      </div>
    </form>

    <datalist id="trip-cities">
      <option v-for="c in cities" :key="c" :value="c" />
    </datalist>
  </div>
</template>
