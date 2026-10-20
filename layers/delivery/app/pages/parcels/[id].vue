<script setup lang="ts">
// The sender's parcel page: what to do now (show your QR), where it is, and every handover so far.
const id = useRoute().params.id as string
const delivery = useDelivery()
const { isOps } = useAuth()
const { data, refresh } = await useApiData(`parcel:${id}`, () => delivery.getParcel(id))
useHead({ title: `${formatRef(data.value.parcel.number)}` })

const p = computed(() => data.value!.parcel)
const turn = computed(() => data.value!.yourTurn)
const trackUrl = computed(() => (import.meta.client ? `${location.origin}/t/${p.value.trackToken}` : ''))

// While it's the sender's turn, check now and then whether the other side has scanned.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(() => (turn.value || data.value?.waitingForCourier) && refresh(), 15_000)))
onBeforeUnmount(() => clearInterval(timer))

const PARTY_ICON: Record<string, IconName> = { SENDER: 'user', COURIER: 'bike', CENTRE: 'hubs', TRAVELLER: 'trips', RECIPIENT: 'home' }
</script>

<script lang="ts">
import type { IconName } from '~~/layers/core/app/components/AppIcon.vue'
</script>

<template>
  <div v-if="data">
    <BackButton style="margin-left: -12px" />

    <h1 style="margin-top: 8px" :class="{ 'tone-ok': p.status === 'DELIVERED' }">{{ PARCEL_STATUS[p.status as ParcelStatusName]?.label ?? p.status }}</h1>
    <p class="soft" style="margin-top: 6px">{{ p.recipientName }}, {{ p.toCity }} · <span class="figure">{{ formatRef(p.number) }}</span></p>

    <!-- What to do now -->
    <section v-if="turn" class="panel stack" style="margin-top: 18px">
      <template v-if="turn.place">
        <h2>Take it to {{ turn.place.name }}</h2>
        <p class="soft small">
          <span class="mono">{{ turn.place.postcode }}</span><template v-if="turn.place.address"> · {{ turn.place.address }}</template>
          <template v-if="turn.place.hours"> · {{ turn.place.hours }}</template>
        </p>
      </template>
      <h2 v-else>{{ firstName(turn.to.name) }} is coming for it</h2>
      <HandoverQr :token="turn.token" :code="turn.code" :to="turn.place ? 'the centre' : firstName(turn.to.name)" />
    </section>

    <section v-else-if="data.waitingForCourier" class="panel" style="margin-top: 18px">
      <div class="hero-icon"><AppIcon name="timer" /></div>
      <h2>Finding a courier</h2>
      <p class="soft" style="margin-top: 6px">When one accepts, your QR appears here for them to scan.</p>
    </section>

    <JourneyMap v-if="data.journey" :journey="data.journey" />
    <StageBar :status="p.status" />

    <a
      v-if="p.status !== 'DELIVERED'"
      :href="whatsappLink(p.recipientPhone, `Your parcel is on its way with Posta. Track it here: ${trackUrl}`)"
      target="_blank"
      rel="noopener"
      class="btn whatsapp block"
    >
      <AppIcon name="chat" />Send tracking to {{ firstName(p.recipientName) }}
    </a>

    <!-- Every handover: the sender sees the whole chain for their parcel -->
    <section style="margin-top: 24px">
      <div class="label"><h2>Handovers</h2></div>
      <ol class="list">
        <li v-for="h in data.chain" :key="h.seq" class="item">
          <span class="item-icon" :class="{ ok: h.status === 'DONE' }"><AppIcon :name="h.status === 'DONE' ? 'done' : PARTY_ICON[h.to.party] ?? 'parcel'" /></span>
          <span>
            <b :class="{ faint: h.status === 'WAITING' }">{{ h.from.name }} → {{ h.to.name }}</b>
            <span class="sub">{{ h.status === 'DONE' ? formatDateTime(h.doneAt!) : h.status === 'READY' ? 'Next' : 'Later' }}</span>
          </span>
          <span />
        </li>
      </ol>
    </section>

    <details class="more" style="margin-top: 16px">
      <summary>Details <AppIcon name="chevron" /></summary>
      <ul class="facts" style="margin-top: 8px">
        <li><AppIcon name="pin" /><span><span class="mono">{{ p.pickupPostcode }}</span> → <span class="mono">{{ p.dropPostcode }}</span></span></li>
        <li><AppIcon name="parcel" />{{ p.description }} · {{ p.weightKg }} kg</li>
        <li><AppIcon name="money" />{{ formatNaira(p.valueKobo) }}</li>
        <li><AppIcon name="user" />{{ p.recipientName }} · {{ p.recipientPhone }}</li>
      </ul>
    </details>

    <details v-if="isOps" class="more">
      <summary>Staff <AppIcon name="staff" /></summary>
      <ul class="facts" style="margin-top: 8px">
        <li v-for="l in data.legs" :key="l.id" class="row">
          <span><b>{{ l.kind }}: {{ l.carrierName ?? 'not assigned' }}</b><br /><span class="small soft">{{ l.status }}</span></span>
          <CopyLink :path="`/l/${l.linkToken}`" label="Job link" />
        </li>
      </ul>
      <ul class="timeline" style="margin-top: 8px">
        <template v-for="e in data.events" :key="e.id">
          <li v-if="eventText(e.type, e.data as any)">
            <time>{{ formatDateTime(e.at) }}</time><span>{{ eventText(e.type, e.data as any) }}</span>
          </li>
        </template>
      </ul>
    </details>
  </div>
</template>
