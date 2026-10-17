<script setup lang="ts">
// Register a shop as a fulfilment centre. Staff approve it before it receives parcels.
definePageMeta({ layout: false })
useHead({ title: 'Fulfilment centre · Posta' })

const delivery = useDelivery()
const hubs = useHubs()
const { data } = await useApiData('home', () => delivery.loadHome())
const cities = computed(() => data.value?.cities ?? [])

const HOURS = ['Mon–Sat, 8am–6pm', 'Every day, 8am–8pm', 'Mon–Fri, 9am–5pm']

const f = reactive({
  lat: '' as string | number,
  lng: '' as string | number,
  city: '',
  address: '',
  postcode: '',
  name: '',
  contactPhone: data.value?.me.phone ?? '',
  openingHours: '',
})
const otherCity = ref(false)
const manual = ref(false)
const locating = ref(false)
const locateError = ref('')

// Shop owners are usually at the shop: one tap gives the exact spot.
function locate() {
  locateError.value = ''
  if (!navigator.geolocation) return void (manual.value = true)
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      f.lat = Number(pos.coords.latitude.toFixed(6))
      f.lng = Number(pos.coords.longitude.toFixed(6))
      locating.value = false
    },
    () => {
      locating.value = false
      locateError.value = 'Could not get your location. Enter it instead.'
      manual.value = true
    },
    { enableHighAccuracy: true, timeout: 15_000 },
  )
}

const located = computed(() => f.lat !== '' && f.lng !== '')
const phoneOk = (p: string) => /^\+?\d[\d\s]{9,15}$/.test(p.trim())
const steps = [
  { q: 'Where is the centre?', ok: () => located.value && f.city.trim().length > 1, fields: ['lat', 'lng', 'city'] },
  { q: 'Address and postcode', ok: () => f.address.trim().length > 4 && !!normalizePostcode(f.postcode), fields: ['address', 'postcode'] },
  { q: 'Name and phone', ok: () => f.name.trim().length > 1 && phoneOk(f.contactPhone), fields: ['name', 'contactPhone'] },
  { q: 'When are you open?', ok: () => f.openingHours.trim().length > 2, fields: ['openingHours'] },
]
const i = ref(0)
const done = ref(false)
const { busy, error, field, run } = useSubmit()

async function next() {
  if (i.value < steps.length - 1) return void i.value++
  const res = await run(() => hubs.register({ ...f, lat: Number(f.lat), lng: Number(f.lng) }))
  if (res) {
    if (res.status === 'APPROVED') return navigateTo('/hubs', { replace: true }) // staff: live at once
    done.value = true
  } else {
    const at = steps.findIndex((s) => s.fields.includes(field.value))
    if (at >= 0) i.value = at
  }
}
const back = () => (i.value ? i.value-- : navigateTo('/join'))
</script>

<template>
  <AppliedScreen v-if="done" what="fulfilment centre" />
  <Wizard
    v-else
    :step="i + 1"
    :total="steps.length"
    :question="steps[i]!.q"
    :can-next="steps[i]!.ok()"
    :busy="busy"
    :error="error"
    :next-label="i === steps.length - 1 ? 'Register' : 'Next'"
    @back="back"
    @next="next"
  >
    <template v-if="i === 0">
      <button type="button" class="chip tall" :class="{ on: located }" :disabled="locating" @click="locate">
        <AppIcon :name="located ? 'done' : 'gps'" style="font-size: 36px" />
        {{ locating ? 'Finding you…' : located ? 'Location saved' : "I'm at the centre now" }}
        <small v-if="located">{{ f.lat }}, {{ f.lng }}</small>
      </button>
      <p v-if="locateError" class="error-text">{{ locateError }}</p>
      <button v-if="!manual && !located" type="button" class="btn quiet small" @click="manual = true">Enter the location instead</button>
      <div v-if="manual" class="chips" style="grid-template-columns: 1fr 1fr">
        <input v-model="f.lat" class="big-input" inputmode="decimal" placeholder="Latitude" />
        <input v-model="f.lng" class="big-input" inputmode="decimal" placeholder="Longitude" />
      </div>

      <p class="field-label">City</p>
      <div class="chips">
        <button v-for="c in cities" :key="c" type="button" class="chip" :class="{ on: f.city === c && !otherCity }" @click="(f.city = c), (otherCity = false)">{{ c }}</button>
        <button type="button" class="chip" :class="{ on: otherCity }" @click="(otherCity = true), (f.city = '')">Other</button>
      </div>
      <input v-if="otherCity" v-model="f.city" class="big-input" placeholder="City" />
    </template>

    <template v-else-if="i === 1">
      <input v-model="f.address" class="big-input" placeholder="Street address" autocomplete="street-address" />
      <PostcodeInput v-model="f.postcode" big />
    </template>

    <template v-else-if="i === 2">
      <input v-model="f.name" class="big-input" placeholder="Centre name" />
      <input v-model="f.contactPhone" class="big-input" placeholder="Phone" type="tel" inputmode="tel" />
    </template>

    <template v-else>
      <div class="stack">
        <button v-for="h in HOURS" :key="h" type="button" class="chip" :class="{ on: f.openingHours === h }" @click="f.openingHours = h">{{ h }}</button>
      </div>
      <input v-model="f.openingHours" class="big-input" placeholder="Or type your hours" maxlength="60" />
    </template>
  </Wizard>
</template>
