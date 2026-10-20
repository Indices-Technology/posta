<script setup lang="ts">
/**
 * Send a parcel, one question per screen:
 *   where it goes → how it arrives (door / collect) → who receives it →
 *   where it is now → how it starts (drop at a centre / a courier collects) → what → worth → check.
 * Cities are never asked: they come from the centres.
 */
import type { NearCentre, NearCourier } from '../types/delivery.types'

definePageMeta({ layout: false })
useHead({ title: 'Send a parcel' })

const delivery = useDelivery()
const { data } = await useApiData('home', () => delivery.loadHome())

const SIZES = [
  { key: 'S', label: 'Small', sub: 'Up to 2 kg', kg: 2 },
  { key: 'M', label: 'Medium', sub: 'Up to 10 kg', kg: 10 },
  { key: 'L', label: 'Large', sub: 'Up to 30 kg', kg: 30 },
] as const

const f = reactive({
  dropPostcode: '',
  dropLat: null as number | null,
  dropLng: null as number | null,
  lastMile: '' as '' | 'DOOR' | 'COLLECT',
  destHubId: '',
  recipientName: '',
  recipientPhone: '',
  pickupPostcode: '',
  pickupLat: null as number | null,
  pickupLng: null as number | null,
  firstMile: '' as '' | 'DROP_OFF' | 'PICKUP',
  originHubId: '',
  preferredCourierId: '' as string, // '' = fastest available
  description: '',
  size: '' as '' | 'S' | 'M' | 'L',
  valueNaira: '',
  senderName: data.value?.me.name ?? '',
  senderPhone: data.value?.me.phone ?? '',
})

// Centres and couriers near the pins, loaded when those questions come up.
const destCentres = ref<NearCentre[]>([])
const originCentres = ref<NearCentre[]>([])
const couriers = ref<NearCourier[]>([])
const loadingNear = ref(false)

const phoneOk = (p: string) => /^\+?\d[\d\s]{9,15}$/.test(p.trim())
const pinned = (la: number | null, ln: number | null) => la != null && ln != null
const centreName = (list: NearCentre[], id: string) => list.find((c) => c.id === id)?.name ?? ''

const steps = [
  { q: 'Where is it going?', ok: () => !!normalizePostcode(f.dropPostcode) && pinned(f.dropLat, f.dropLng), fields: ['dropPostcode', 'dropLat'] },
  { q: 'How should it arrive?', ok: () => f.lastMile === 'DOOR' || (f.lastMile === 'COLLECT' && !!f.destHubId), fields: ['lastMile', 'destHubId'] },
  { q: 'Who receives it?', ok: () => f.recipientName.trim().length > 1 && phoneOk(f.recipientPhone), fields: ['recipientName', 'recipientPhone'] },
  { q: 'Where is it now?', ok: () => !!normalizePostcode(f.pickupPostcode) && pinned(f.pickupLat, f.pickupLng), fields: ['pickupPostcode', 'pickupLat'] },
  { q: 'How do we get it?', ok: () => f.firstMile === 'PICKUP' || (f.firstMile === 'DROP_OFF' && !!f.originHubId), fields: ['firstMile', 'originHubId', 'preferredCourierId'] },
  { q: 'What is it?', ok: () => f.description.trim().length > 1 && !!f.size, fields: ['description', 'weightKg'] },
  { q: 'What is it worth?', ok: () => f.valueNaira !== '' && Number(f.valueNaira) >= 0, fields: ['valueNaira'] },
  { q: 'Check and send', ok: () => f.senderName.trim().length > 1 && phoneOk(f.senderPhone), fields: ['senderName', 'senderPhone'] },
]
const i = ref(0)
const step = computed(() => steps[i.value]!)

// Load the choices for the "how" questions from the pins just placed.
watch(i, async (n) => {
  loadingNear.value = true
  try {
    if (n === 1 && pinned(f.dropLat, f.dropLng)) destCentres.value = await delivery.centresNear(f.dropLat!, f.dropLng!)
    if (n === 4 && pinned(f.pickupLat, f.pickupLng)) {
      ;[originCentres.value, couriers.value] = await Promise.all([
        delivery.centresNear(f.pickupLat!, f.pickupLng!),
        delivery.couriersNear(f.pickupLat!, f.pickupLng!),
      ])
    }
  } finally {
    loadingNear.value = false
  }
})

const { busy, error, field, run } = useSubmit()

async function next() {
  if (i.value < steps.length - 1) return void i.value++
  const size = SIZES.find((s) => s.key === f.size)!
  const { size: _size, ...rest } = f
  const res = await run(() =>
    delivery.createParcel({
      ...rest,
      lastMile: f.lastMile as 'DOOR' | 'COLLECT',
      firstMile: f.firstMile as 'DROP_OFF' | 'PICKUP',
      destHubId: f.lastMile === 'COLLECT' ? f.destHubId : null,
      originHubId: f.firstMile === 'DROP_OFF' ? f.originHubId : null,
      preferredCourierId: f.firstMile === 'PICKUP' && f.preferredCourierId ? f.preferredCourierId : null,
      weightKg: size.kg,
      valueNaira: Math.round(Number(f.valueNaira)),
    }),
  )
  if (res) return navigateTo(`/parcels/${res.id}`, { replace: true })
  const at = steps.findIndex((s) => s.fields.includes(field.value))
  if (at >= 0) i.value = at
}
const goBack = useBack()
const back = () => (i.value ? i.value-- : goBack('/'))
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
    <PostcodeMapPicker v-if="i === 0" v-model:postcode="f.dropPostcode" v-model:lat="f.dropLat" v-model:lng="f.dropLng" />

    <template v-else-if="i === 1">
      <div class="chips" style="grid-template-columns: 1fr 1fr">
        <button type="button" class="chip tall" :class="{ on: f.lastMile === 'DOOR' }" @click="f.lastMile = 'DOOR'">
          <AppIcon name="home" style="font-size: 34px" />To the door<small>A courier brings it</small>
        </button>
        <button type="button" class="chip tall" :class="{ on: f.lastMile === 'COLLECT' }" @click="f.lastMile = 'COLLECT'">
          <AppIcon name="hubs" style="font-size: 34px" />They collect<small>From a centre near them</small>
        </button>
      </div>
      <template v-if="f.lastMile === 'COLLECT'">
        <p class="field-label">Centres near them</p>
        <CentreChoices v-model="f.destHubId" :centres="destCentres" :loading="loadingNear" />
      </template>
    </template>

    <template v-else-if="i === 2">
      <input v-model="f.recipientName" class="big-input" placeholder="Name" autocomplete="off" />
      <input v-model="f.recipientPhone" class="big-input" placeholder="Phone (WhatsApp)" type="tel" inputmode="tel" />
    </template>

    <PostcodeMapPicker v-else-if="i === 3" v-model:postcode="f.pickupPostcode" v-model:lat="f.pickupLat" v-model:lng="f.pickupLng" />

    <template v-else-if="i === 4">
      <div class="chips" style="grid-template-columns: 1fr 1fr">
        <button type="button" class="chip tall" :class="{ on: f.firstMile === 'DROP_OFF' }" @click="f.firstMile = 'DROP_OFF'">
          <AppIcon name="hubs" style="font-size: 34px" />I'll drop it<small>At a centre near me</small>
        </button>
        <button type="button" class="chip tall" :class="{ on: f.firstMile === 'PICKUP' }" @click="f.firstMile = 'PICKUP'">
          <AppIcon name="bike" style="font-size: 34px" />Pick it up<small>A courier comes to me</small>
        </button>
      </div>

      <template v-if="f.firstMile === 'DROP_OFF'">
        <p class="field-label">Centres near you</p>
        <CentreChoices v-model="f.originHubId" :centres="originCentres" :loading="loadingNear" />
      </template>

      <template v-if="f.firstMile === 'PICKUP'">
        <p class="field-label">Couriers near you</p>
        <ul class="list">
          <li>
            <button type="button" class="item pick" :class="{ on: !f.preferredCourierId }" @click="f.preferredCourierId = ''">
              <span class="item-icon"><AppIcon name="timer" /></span>
              <span><b>Fastest available</b><span class="sub">The nearest free courier takes it</span></span>
              <AppIcon :name="!f.preferredCourierId ? 'done' : 'chevron'" />
            </button>
          </li>
          <li v-for="c in couriers" :key="c.id">
            <button type="button" class="item pick" :class="{ on: f.preferredCourierId === c.id }" @click="f.preferredCourierId = c.id">
              <span class="item-icon"><AppIcon :name="c.vehicle === 'CAR' ? 'car' : c.vehicle === 'VAN' ? 'van' : 'bike'" /></span>
              <span><b>{{ c.firstName }}</b><span class="sub">{{ c.distanceKm != null ? `About ${c.distanceKm} km away` : 'Nearby' }}</span></span>
              <AppIcon :name="f.preferredCourierId === c.id ? 'done' : 'chevron'" />
            </button>
          </li>
        </ul>
        <p v-if="!loadingNear && !couriers.length" class="small soft">No courier is free right now. We'll send it to the first one who is.</p>
      </template>
    </template>

    <template v-else-if="i === 5">
      <div class="chips" style="grid-template-columns: repeat(3, 1fr)">
        <button v-for="s in SIZES" :key="s.key" type="button" class="chip tall" :class="{ on: f.size === s.key }" @click="f.size = s.key">
          <AppIcon name="parcel" :style="{ fontSize: s.key === 'S' ? '24px' : s.key === 'M' ? '32px' : '40px' }" />
          {{ s.label }}<small>{{ s.sub }}</small>
        </button>
      </div>
      <input v-model="f.description" class="big-input" placeholder="What's inside" maxlength="140" />
    </template>

    <template v-else-if="i === 6">
      <div class="money"><span>₦</span><input v-model="f.valueNaira" class="big-input" inputmode="numeric" placeholder="0" /></div>
    </template>

    <template v-else>
      <ul class="facts">
        <li>
          <AppIcon :name="f.firstMile === 'PICKUP' ? 'bike' : 'hubs'" />
          <span>{{ f.firstMile === 'PICKUP' ? 'A courier collects it from you' : `You drop it at ${centreName(originCentres, f.originHubId)}` }}</span>
        </li>
        <li>
          <AppIcon :name="f.lastMile === 'DOOR' ? 'home' : 'hubs'" />
          <span>{{ f.lastMile === 'DOOR' ? `Delivered to ${f.recipientName}'s door` : `${f.recipientName} collects at ${centreName(destCentres, f.destHubId)}` }}</span>
        </li>
        <li><AppIcon name="parcel" />{{ f.description }} · {{ SIZES.find((s) => s.key === f.size)?.label }}</li>
        <li><AppIcon name="money" />{{ naira }}</li>
      </ul>
      <p class="field-label">Your name and phone</p>
      <input v-model="f.senderName" class="big-input" placeholder="Your name" />
      <input v-model="f.senderPhone" class="big-input" placeholder="Your phone" type="tel" inputmode="tel" />
    </template>
  </Wizard>
</template>

<style scoped>
.pick { width: 100%; border: 0; background: none; text-align: left; cursor: pointer; border-radius: 12px; padding-inline: 8px; }
.pick.on { background: var(--sunken); }
</style>
