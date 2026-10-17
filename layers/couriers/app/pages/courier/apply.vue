<script setup lang="ts">
// Apply as a courier (a person). One question per screen.
definePageMeta({ layout: false })
useHead({ title: 'Deliver with Posta' })

const delivery = useDelivery()
const courier = useCourier()
const { data } = await useApiData('home', () => delivery.loadHome())
const cities = computed(() => data.value?.cities ?? [])

const VEHICLES = [
  { key: 'BIKE', label: 'Bike', icon: 'bike' },
  { key: 'CAR', label: 'Car', icon: 'car' },
  { key: 'VAN', label: 'Van', icon: 'van' },
] as const

const f = reactive({
  city: '',
  vehicle: '' as '' | 'BIKE' | 'CAR' | 'VAN',
  name: data.value?.me.name ?? '',
  phone: data.value?.me.phone ?? '',
})
const phoneOk = (p: string) => /^\+?\d[\d\s]{9,15}$/.test(p.trim())
const steps = [
  { q: 'Which city do you work in?', ok: () => !!f.city, fields: ['city'] },
  { q: 'What do you ride?', ok: () => !!f.vehicle, fields: ['vehicle'] },
  { q: 'Your name and phone', ok: () => f.name.trim().length > 1 && phoneOk(f.phone), fields: ['name', 'phone'] },
]
const i = ref(0)
const done = ref(false)
const { busy, error, field, run } = useSubmit()

async function next() {
  if (i.value < steps.length - 1) return void i.value++
  const res = await run(() => courier.apply({ kind: 'INDIVIDUAL', city: f.city, vehicle: f.vehicle as 'BIKE', name: f.name, phone: f.phone }))
  if (res) done.value = true
  else {
    const at = steps.findIndex((s) => s.fields.includes(field.value))
    if (at >= 0) i.value = at
  }
}
const back = () => (i.value ? i.value-- : navigateTo('/join'))
</script>

<template>
  <AppliedScreen v-if="done" what="courier" />
  <Wizard
    v-else
    :step="i + 1"
    :total="steps.length"
    :question="steps[i]!.q"
    :can-next="steps[i]!.ok()"
    :busy="busy"
    :error="error"
    :next-label="i === steps.length - 1 ? 'Apply' : 'Next'"
    @back="back"
    @next="next"
  >
    <div v-if="i === 0" class="chips">
      <button v-for="c in cities" :key="c" type="button" class="chip" :class="{ on: f.city === c }" @click="f.city = c">{{ c }}</button>
    </div>

    <div v-else-if="i === 1" class="chips" style="grid-template-columns: repeat(3, 1fr)">
      <button v-for="v in VEHICLES" :key="v.key" type="button" class="chip tall" :class="{ on: f.vehicle === v.key }" @click="f.vehicle = v.key">
        <AppIcon :name="v.icon" style="font-size: 36px" />{{ v.label }}
      </button>
    </div>

    <template v-else>
      <input v-model="f.name" class="big-input" placeholder="Your name" autocomplete="name" />
      <input v-model="f.phone" class="big-input" placeholder="Phone (WhatsApp)" type="tel" inputmode="tel" />
    </template>
  </Wizard>
</template>
