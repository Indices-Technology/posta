<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch(`/api/parcels/${route.params.id}`)
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Parcel not found', fatal: true })
useHead({ title: `${formatRef(data.value.parcel.number)} · Posta` })

const p = computed(() => data.value!.parcel)
const leg1 = computed(() => data.value!.legs.find((l) => l.seq === 1))
const leg2 = computed(() => data.value!.legs.find((l) => l.seq === 2))

// The parcel's whole journey as stages; the first unfinished one is "now".
const stages = computed(() => {
  const list = [
    { key: 'booked', title: 'Booked', at: p.value.createdAt, done: true },
    {
      key: 'matched',
      title: leg1.value ? `On ${leg1.value.carrierName}'s trip` : 'Waiting for a trip',
      sub: leg1.value?.trip ? `Leaves ${formatDateTime(leg1.value.trip.departAt)}` : `The first trip from ${p.value.fromCity} to ${p.value.toCity} takes it`,
      done: !!leg1.value,
      leg: leg1.value,
    },
    { key: 'collected', title: `Collected in ${p.value.fromCity}`, sub: p.value.pickupPostcode, at: leg1.value?.collectedAt, done: !!leg1.value?.collectedAt },
    {
      key: 'hub',
      title: `At ${leg1.value?.toPlace ?? 'the handover point'}`,
      sub: leg1.value?.toPostcode,
      at: leg1.value?.handedOverAt,
      done: !!leg1.value?.handedOverAt,
      leg: leg2.value,
    },
    { key: 'out', title: 'Out for delivery', sub: leg2.value ? `With ${leg2.value.carrierName}` : undefined, at: leg2.value?.collectedAt, done: !!leg2.value?.collectedAt },
    { key: 'delivered', title: `Delivered to ${p.value.recipientName}`, sub: p.value.dropPostcode, at: leg2.value?.handedOverAt, done: !!leg2.value?.handedOverAt },
  ]
  const now = list.findIndex((s) => !s.done)
  return list.map((s, i) => ({ ...s, now: i === now }))
})
</script>

<template>
  <div v-if="data">
    <NuxtLink to="/parcels" class="back"><AppIcon name="back" />Parcels</NuxtLink>
    <div class="page-head">
      <div>
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap">
          <h1 class="figure">{{ formatRef(p.number) }}</h1>
          <StatusLabel :status="p.status" />
        </div>
        <p class="sub">{{ p.description }} · {{ p.fromCity }} to {{ p.toCity }}</p>
      </div>
      <CopyLink :path="`/t/${p.trackToken}`" label="Copy tracking link" />
    </div>

    <div class="split">
      <div>
        <section class="section">
          <div class="section-head"><h2>Journey</h2></div>
          <ol class="journey">
            <li v-for="s in stages" :key="s.key" :class="{ done: s.done, now: s.now }">
              <i class="mark" />
              <div class="row" style="align-items: flex-start">
                <div>
                  <p class="row-title" :class="{ faint: !s.done && !s.now }">{{ s.title }}</p>
                  <p v-if="s.sub" class="row-sub" :class="{ mono: s.sub === p.pickupPostcode || s.sub === p.dropPostcode || s.sub === leg1?.toPostcode }">{{ s.sub }}</p>
                  <p v-if="s.leg && s.leg.locked" class="small tone-alert" style="margin-top: 4px">Locked after 5 wrong codes</p>
                </div>
                <p v-if="s.at" class="small faint" style="white-space: nowrap">{{ formatDateTime(s.at) }}</p>
              </div>
              <div v-if="s.leg && s.leg.status !== 'HANDED_OVER'" class="row" style="justify-content: flex-start; margin-top: 10px; flex-wrap: wrap">
                <CopyLink :path="`/l/${s.leg.linkToken}`" :label="`Copy ${s.leg.kind === 'LINEHAUL' ? 'driver' : 'courier'} link`" />
                <a :href="`tel:${s.leg.carrierPhone}`" class="btn quiet small"><AppIcon name="phone" />{{ s.leg.carrierPhone }}</a>
              </div>
            </li>
          </ol>
        </section>

        <section class="section">
          <div class="section-head"><h2>History</h2></div>
          <ul class="timeline">
            <template v-for="e in data.events" :key="e.id">
              <li v-if="eventText(e.type, e.data as any)">
                <time>{{ formatDateTime(e.at) }}</time>
                <span>{{ eventText(e.type, e.data as any) }}</span>
              </li>
            </template>
          </ul>
        </section>
      </div>

      <aside>
        <section class="panel section">
          <h2 style="margin-bottom: 4px">Handover codes</h2>
          <p class="small soft" style="margin-bottom: 14px">Whoever receives the parcel reads their code to the person handing it over.</p>
          <ul v-if="data.codes.length" class="rows">
            <li v-for="c in data.codes" :key="c.code" class="row-static" style="--cols: 1fr auto">
              <div>
                <p class="row-title">{{ c.holder }}</p>
                <p class="row-sub">{{ c.use }}</p>
              </div>
              <p class="mono" style="font-size: 18px; font-weight: 750">{{ formatCode(c.code) }}</p>
            </li>
          </ul>
          <p v-else class="small faint">Codes appear once the parcel is on a trip.</p>
        </section>

        <section class="section">
          <div class="section-head"><h2>Details</h2></div>
          <dl class="kv">
            <dt>Sender</dt>
            <dd>{{ p.senderName }}<br /><span class="soft">{{ p.senderPhone }}</span></dd>
            <dt>Recipient</dt>
            <dd>{{ p.recipientName }}<br /><span class="soft">{{ p.recipientPhone }}</span></dd>
            <dt>Pickup</dt>
            <dd class="mono">{{ p.pickupPostcode }}</dd>
            <dt>Delivery</dt>
            <dd class="mono">{{ p.dropPostcode }}</dd>
            <dt>Weight</dt>
            <dd>{{ p.weightKg }} kg</dd>
            <dt>Declared value</dt>
            <dd>{{ formatNaira(p.valueKobo) }}</dd>
          </dl>
        </section>
      </aside>
    </div>
  </div>
</template>
