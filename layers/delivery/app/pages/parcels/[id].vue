<script setup lang="ts">
const id = useRoute().params.id as string
const delivery = useDelivery()
const { isOps } = useAuth()
const { data } = await useApiData(`parcel:${id}`, () => delivery.getParcel(id))
useHead({ title: `${formatRef(data.value.parcel.number)} · Posta` })
const p = computed(() => data.value!.parcel)
const leg1 = computed(() => data.value!.legs.find((l) => l.seq === 1))
const senderCode = computed(() => data.value!.codes.find((c) => c.holder === 'Sender')?.code)
const waitingForDriver = computed(() => p.value.status === 'MATCHED' && leg1.value)

const trackUrl = computed(() => (import.meta.client ? `${location.origin}/t/${p.value.trackToken}` : ''))
const firstName = (n: string) => n.split(' ')[0]
</script>

<template>
  <div v-if="data">
    <NuxtLink to="/" class="iconbtn" aria-label="Home" style="margin-left: -12px"><AppIcon name="back" /></NuxtLink>

    <h1 style="margin-top: 8px" :class="{ 'tone-ok': p.status === 'DELIVERED' }">{{ PARCEL_STATUS[p.status as ParcelStatusName].label }}</h1>
    <p class="soft" style="margin-top: 6px">{{ p.recipientName }}, {{ p.toCity }} · <span class="figure">{{ formatRef(p.number) }}</span></p>

    <StageBar :status="p.status" />

    <!-- The one thing to do now -->
    <section v-if="p.status === 'NEW'" class="panel">
      <div class="hero-icon"><AppIcon name="waiting" /></div>
      <h2>Looking for a traveller</h2>
      <p class="soft" style="margin-top: 6px">The first trip to {{ p.toCity }} takes it.</p>
    </section>

    <section v-else-if="waitingForDriver" class="panel">
      <p class="soft" style="font-weight: 700">Give {{ firstName(leg1!.carrierName) }} this code at pickup</p>
      <p class="big-code" style="margin: 14px 0 18px">{{ formatCode(senderCode!) }}</p>
      <div class="row">
        <div>
          <b>{{ leg1!.carrierName }}</b>
          <p class="small soft">{{ leg1!.trip ? `Leaves ${formatDateTime(leg1!.trip.departAt)}` : '' }}</p>
        </div>
        <a :href="`tel:${leg1!.carrierPhone}`" class="btn quiet small"><AppIcon name="phone" />Call</a>
      </div>
    </section>

    <section v-else-if="p.status === 'DELIVERED'" class="panel" style="text-align: center">
      <div class="hero-icon ok" style="margin-inline: auto"><AppIcon name="done" /></div>
      <h2>Delivered</h2>
      <p class="soft" style="margin-top: 6px">{{ p.recipientName }} has it.</p>
    </section>

    <section v-else class="panel">
      <div class="hero-icon"><AppIcon :name="STATUS_ICON[p.status] ?? 'road'" /></div>
      <h2>On its way</h2>
      <p class="soft" style="margin-top: 6px">{{ firstName(p.recipientName) }} gets a code to give the courier.</p>
    </section>

    <div v-if="p.status !== 'DELIVERED'" class="stack" style="margin-top: 16px">
      <a :href="whatsappLink(p.recipientPhone, `Your parcel is on its way with Posta. Track it here: ${trackUrl}`)" target="_blank" rel="noopener" class="btn whatsapp block">
        <AppIcon name="chat" />Send tracking to {{ firstName(p.recipientName) }}
      </a>
    </div>

    <details class="more" style="margin-top: 24px">
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
        <li v-for="c in data.codes" :key="c.code" class="row">
          <span><b>{{ c.holder }}</b><br /><span class="small soft">{{ c.use }}</span></span>
          <span class="mono" style="font-size: 20px">{{ formatCode(c.code) }}</span>
        </li>
        <li v-for="l in data.legs" :key="l.id" class="row">
          <span><b>{{ l.kind === 'LINEHAUL' ? 'Driver' : 'Courier' }}: {{ l.carrierName }}</b><br /><span class="small soft">{{ l.locked ? 'Locked after 5 wrong codes' : l.status }}</span></span>
          <CopyLink v-if="l.linkToken" :path="`/l/${l.linkToken}`" label="Job link" />
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
