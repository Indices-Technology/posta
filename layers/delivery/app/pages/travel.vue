<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: "I'm travelling · Posta" })

const delivery = useDelivery()
const { data } = await useApiData('home', () => delivery.loadHome())
const cities = computed(() => data.value?.cities ?? [])

const f = reactive({
  fromCity: '',
  toCity: '',
  leaveDay: 0, // days from today
  leaveTime: '07:00',
  arriveDay: 0, // days after leaving
  arriveTime: '17:00',
  capacity: 0,
  driverName: data.value?.me.name ?? '',
  driverPhone: data.value?.me.phone ?? '',
})
const otherFrom = ref(false)

// The person's own clock: Posta is used in Nigeria, the browser knows the right timezone.
function at(dayOffset: number, time: string) {
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h!, m!, 0, 0)
  return d
}
const departAt = computed(() => at(f.leaveDay, f.leaveTime))
const arriveBy = computed(() => at(f.leaveDay + f.arriveDay, f.arriveTime))

const phoneOk = (p: string) => /^\+?\d[\d\s]{9,15}$/.test(p.trim())
const steps = [
  { q: 'Where are you leaving from?', ok: () => f.fromCity.trim().length > 1, fields: ['fromCity'] },
  { q: 'Where are you going?', ok: () => !!f.toCity && f.toCity !== f.fromCity, fields: ['toCity'] },
  { q: 'When do you leave?', ok: () => !!f.leaveTime && departAt.value > new Date(), fields: ['departAt'] },
  { q: 'When do you arrive?', ok: () => !!f.arriveTime && arriveBy.value > departAt.value, fields: ['arriveBy'] },
  { q: 'How many parcels fit?', ok: () => f.capacity > 0, fields: ['capacity'] },
  { q: 'Check and post', ok: () => f.driverName.trim().length > 1 && phoneOk(f.driverPhone), fields: ['driverName', 'driverPhone'] },
]
const i = ref(0)
const step = computed(() => steps[i.value]!)
const { busy, error, field, run } = useSubmit()

async function next() {
  if (i.value < steps.length - 1) return void i.value++
  const res = await run(() =>
    delivery.createTrip({
      driverName: f.driverName,
      driverPhone: f.driverPhone,
      fromCity: f.fromCity,
      toCity: f.toCity,
      capacity: f.capacity,
      departAt: departAt.value,
      arriveBy: arriveBy.value,
    }),
  )
  if (res) return navigateTo(`/trips/${res.id}`, { replace: true })
  const back = steps.findIndex((s) => s.fields.includes(field.value))
  if (back >= 0) i.value = back
}
const back = () => (i.value ? i.value-- : navigateTo('/'))
</script>

<template>
  <Wizard
    :step="i + 1"
    :total="steps.length"
    :question="step.q"
    :can-next="step.ok()"
    :busy="busy"
    :error="error"
    :next-label="i === steps.length - 1 ? 'Post trip' : 'Next'"
    @back="back"
    @next="next"
  >
    <template v-if="i === 0">
      <div class="chips">
        <button v-for="c in cities" :key="c" type="button" class="chip" :class="{ on: f.fromCity === c && !otherFrom }" @click="(f.fromCity = c), (otherFrom = false)">{{ c }}</button>
        <button type="button" class="chip" :class="{ on: otherFrom }" @click="(otherFrom = true), (f.fromCity = '')">Other</button>
      </div>
      <input v-if="otherFrom" v-model="f.fromCity" class="big-input" placeholder="City" />
    </template>

    <template v-else-if="i === 1">
      <div class="chips">
        <button v-for="c in cities.filter((c) => c !== f.fromCity)" :key="c" type="button" class="chip" :class="{ on: f.toCity === c }" @click="f.toCity = c">{{ c }}</button>
      </div>
    </template>

    <template v-else-if="i === 2">
      <div class="chips" style="grid-template-columns: 1fr 1fr">
        <button type="button" class="chip" :class="{ on: f.leaveDay === 0 }" @click="f.leaveDay = 0">Today</button>
        <button type="button" class="chip" :class="{ on: f.leaveDay === 1 }" @click="f.leaveDay = 1">Tomorrow</button>
      </div>
      <input v-model="f.leaveTime" class="big-input" type="time" aria-label="Time" />
      <p v-if="f.leaveTime && departAt <= new Date()" class="error-text">That time has passed.</p>
    </template>

    <template v-else-if="i === 3">
      <div class="chips" style="grid-template-columns: 1fr 1fr">
        <button type="button" class="chip" :class="{ on: f.arriveDay === 0 }" @click="f.arriveDay = 0">Same day</button>
        <button type="button" class="chip" :class="{ on: f.arriveDay === 1 }" @click="f.arriveDay = 1">Next day</button>
      </div>
      <input v-model="f.arriveTime" class="big-input" type="time" aria-label="Time" />
      <p v-if="f.arriveTime && arriveBy <= departAt" class="error-text">Arrival must be after you leave.</p>
    </template>

    <template v-else-if="i === 4">
      <div class="chips nums">
        <button v-for="n in 5" :key="n" type="button" class="chip" :class="{ on: f.capacity === n }" @click="f.capacity = n">{{ n }}</button>
      </div>
    </template>

    <template v-else>
      <div class="route">
        <div class="end"><b>{{ f.fromCity }}</b><p class="soft">{{ formatDateTime(departAt) }}</p></div>
        <AppIcon name="arrow" />
        <div class="end" style="text-align: right"><b>{{ f.toCity }}</b><p class="soft">{{ formatDateTime(arriveBy) }}</p></div>
      </div>
      <ul class="facts">
        <li><AppIcon name="parcel" />Room for {{ f.capacity }} {{ f.capacity === 1 ? 'parcel' : 'parcels' }}</li>
      </ul>
      <p class="field-label">Your name and phone</p>
      <input v-model="f.driverName" class="big-input" placeholder="Your name" />
      <input v-model="f.driverPhone" class="big-input" placeholder="Your phone" type="tel" inputmode="tel" />
    </template>
  </Wizard>
</template>
