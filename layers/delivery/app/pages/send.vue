<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'Send a parcel · Posta' })

const delivery = useDelivery()
const { data } = await useApiData('home', () => delivery.loadHome())
const cities = computed(() => data.value?.cities ?? [])

const SIZES = [
  { key: 'S', label: 'Small', sub: 'Up to 2 kg', kg: 2 },
  { key: 'M', label: 'Medium', sub: 'Up to 10 kg', kg: 10 },
  { key: 'L', label: 'Large', sub: 'Up to 30 kg', kg: 30 },
] as const

const f = reactive({
  fromCity: '',
  pickupPostcode: '',
  toCity: '',
  pickupLat: null as number | null,
  pickupLng: null as number | null,
  dropPostcode: '',
  dropLat: null as number | null,
  dropLng: null as number | null,
  recipientName: '',
  recipientPhone: '',
  description: '',
  size: '' as '' | 'S' | 'M' | 'L',
  valueNaira: '',
  senderName: data.value?.me.name ?? '',
  senderPhone: data.value?.me.phone ?? '',
})
const otherFrom = ref(false)


const phoneOk = (p: string) => /^\+?\d[\d\s]{9,15}$/.test(p.trim())
const postcodeOk = (p: string) => !!normalizePostcode(p)

const steps = [
  { q: 'Where do we collect it?', ok: () => f.fromCity.trim().length > 1 && postcodeOk(f.pickupPostcode), fields: ['fromCity', 'pickupPostcode'] },
  { q: 'Where is it going?', ok: () => !!f.toCity && postcodeOk(f.dropPostcode), fields: ['toCity', 'dropPostcode'] },
  { q: 'Who receives it?', ok: () => f.recipientName.trim().length > 1 && phoneOk(f.recipientPhone), fields: ['recipientName', 'recipientPhone'] },
  { q: 'What is it?', ok: () => f.description.trim().length > 1 && !!f.size, fields: ['description', 'weightKg'] },
  { q: 'What is it worth?', ok: () => f.valueNaira !== '' && Number(f.valueNaira) >= 0, fields: ['valueNaira'] },
  { q: 'Check and send', ok: () => f.senderName.trim().length > 1 && phoneOk(f.senderPhone), fields: ['senderName', 'senderPhone'] },
]
const i = ref(0)
const step = computed(() => steps[i.value]!)

const { busy, error, field, run } = useSubmit()

async function next() {
  if (i.value < steps.length - 1) return void i.value++
  const size = SIZES.find((s) => s.key === f.size)!
  const { size: _size, ...body } = f
  const res = await run(() => delivery.createParcel({ ...body, weightKg: size.kg, valueNaira: Math.round(Number(f.valueNaira)) }))
  if (res) return navigateTo(`/parcels/${res.id}`, { replace: true })
  // Send the person back to the screen that holds the problem.
  const at = steps.findIndex((s) => s.fields.includes(field.value))
  if (at >= 0) i.value = at
}
const back = () => (i.value ? i.value-- : navigateTo('/'))
const naira = computed(() => (f.valueNaira === '' ? '' : formatNaira(Number(f.valueNaira) * 100)))
</script>

<template>
  <Wizard
    :step="i + 1"
    :total="steps.length"
    :question="step.q"
    :can-next="step.ok()"
    :busy="busy"
    :error="error"
    :next-label="i === steps.length - 1 ? 'Send parcel' : 'Next'"
    @back="back"
    @next="next"
  >
    <template v-if="i === 0">
      <div class="chips">
        <button v-for="c in cities" :key="c" type="button" class="chip" :class="{ on: f.fromCity === c && !otherFrom }" @click="(f.fromCity = c), (otherFrom = false)">{{ c }}</button>
        <button type="button" class="chip" :class="{ on: otherFrom }" @click="(otherFrom = true), (f.fromCity = '')">Other</button>
      </div>
      <input v-if="otherFrom" v-model="f.fromCity" class="big-input" placeholder="City" autofocus />
      <PostcodeMapPicker v-model:postcode="f.pickupPostcode" v-model:lat="f.pickupLat" v-model:lng="f.pickupLng" :near="f.fromCity" />
    </template>

    <template v-else-if="i === 1">
      <div class="chips">
        <button v-for="c in cities" :key="c" type="button" class="chip" :class="{ on: f.toCity === c }" @click="f.toCity = c">{{ c }}</button>
      </div>
      <PostcodeMapPicker v-model:postcode="f.dropPostcode" v-model:lat="f.dropLat" v-model:lng="f.dropLng" :near="f.toCity" />
    </template>

    <template v-else-if="i === 2">
      <input v-model="f.recipientName" class="big-input" placeholder="Name" autocomplete="off" />
      <input v-model="f.recipientPhone" class="big-input" placeholder="Phone" type="tel" inputmode="tel" />
    </template>

    <template v-else-if="i === 3">
      <div class="chips" style="grid-template-columns: repeat(3, 1fr)">
        <button v-for="s in SIZES" :key="s.key" type="button" class="chip tall" :class="{ on: f.size === s.key }" @click="f.size = s.key">
          <AppIcon name="parcel" :style="{ fontSize: s.key === 'S' ? '24px' : s.key === 'M' ? '32px' : '40px' }" />
          {{ s.label }}<small>{{ s.sub }}</small>
        </button>
      </div>
      <input v-model="f.description" class="big-input" placeholder="What's inside" maxlength="140" />
    </template>

    <template v-else-if="i === 4">
      <div class="money"><span>₦</span><input v-model="f.valueNaira" class="big-input" inputmode="numeric" placeholder="0" autofocus /></div>
    </template>

    <template v-else>
      <div class="route">
        <div class="end"><b>{{ f.fromCity }}</b><p class="mono soft">{{ normalizePostcode(f.pickupPostcode) }}</p></div>
        <AppIcon name="arrow" />
        <div class="end" style="text-align: right"><b>{{ f.toCity }}</b><p class="mono soft">{{ normalizePostcode(f.dropPostcode) }}</p></div>
      </div>
      <ul class="facts">
        <li><AppIcon name="user" />{{ f.recipientName }} · {{ f.recipientPhone }}</li>
        <li><AppIcon name="parcel" />{{ f.description }} · {{ SIZES.find((s) => s.key === f.size)?.label }}</li>
        <li><AppIcon name="money" />{{ naira }}</li>
      </ul>
      <p class="field-label">Your name and phone</p>
      <input v-model="f.senderName" class="big-input" placeholder="Your name" />
      <input v-model="f.senderPhone" class="big-input" placeholder="Your phone" type="tel" inputmode="tel" />
    </template>
  </Wizard>
</template>
