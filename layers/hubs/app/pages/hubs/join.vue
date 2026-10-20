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
  city: '',
  lat: null as number | null,
  lng: null as number | null,
  postcode: '',
  address: '',
  name: '',
  contactPhone: data.value?.me.phone ?? '',
  openingHours: '',
})
const otherCity = ref(false)

const phoneOk = (p: string) => /^\+?\d[\d\s]{9,15}$/.test(p.trim())
const steps = [
  { q: 'Which city?', ok: () => f.city.trim().length > 1, fields: ['city'] },
  {
    // One tap on the map gives the centre's exact spot and its national postcode.
    q: 'Where is the centre?',
    ok: () => f.lat != null && f.lng != null && !!normalizePostcode(f.postcode),
    fields: ['lat', 'lng', 'postcode'],
  },
  { q: 'Street address', ok: () => f.address.trim().length > 4, fields: ['address'] },
  { q: 'Name and phone', ok: () => f.name.trim().length > 1 && phoneOk(f.contactPhone), fields: ['name', 'contactPhone'] },
  { q: 'When are you open?', ok: () => f.openingHours.trim().length > 2, fields: ['openingHours'] },
]
const i = ref(0)
const done = ref(false)
const { busy, error, field, run } = useSubmit()

async function next() {
  if (i.value < steps.length - 1) return void i.value++
  const res = await run(() => hubs.register({ ...f, lat: f.lat!, lng: f.lng! }))
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
      <div class="chips">
        <button v-for="c in cities" :key="c" type="button" class="chip" :class="{ on: f.city === c && !otherCity }" @click="(f.city = c), (otherCity = false)">{{ c }}</button>
        <button type="button" class="chip" :class="{ on: otherCity }" @click="(otherCity = true), (f.city = '')">Other</button>
      </div>
      <input v-if="otherCity" v-model="f.city" class="big-input" placeholder="City" />
    </template>

    <PostcodeMapPicker v-else-if="i === 1" v-model:postcode="f.postcode" v-model:lat="f.lat" v-model:lng="f.lng" :near="f.city" />

    <template v-else-if="i === 2">
      <input v-model="f.address" class="big-input" placeholder="Street address" autocomplete="street-address" />
      <p class="small soft">
        Postcode <span class="mono">{{ f.postcode }}</span>. Add the street so couriers can find the door.
      </p>
    </template>

    <template v-else-if="i === 3">
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
