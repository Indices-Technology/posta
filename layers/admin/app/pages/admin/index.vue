<script setup lang="ts">
// Staff only (the API refuses everyone else): applications, what's stuck, every parcel.
definePageMeta({ wide: true })
useHead({ title: 'Staff · Posta' })
const admin = useAdmin()
const { data, refresh } = await useApiData('admin:overview', () => admin.overview())
const { busy, error, run } = useSubmit()
const note = ref('')

async function decide(type: 'courier' | 'centre', id: string, decision: 'APPROVED' | 'REJECTED') {
  const res = await run(() => admin.review(type, id, decision))
  if (res) {
    note.value = 'assigned' in res && res.assigned ? `${res.assigned} waiting ${res.assigned === 1 ? 'parcel' : 'parcels'} given to this courier.` : ''
    await refresh()
  }
}

async function retryCouriers() {
  const res = await run(() => admin.assignCouriers())
  if (res) {
    note.value = res.assigned ? `${res.assigned} assigned.` : 'Still no courier free in those cities.'
    await refresh()
  }
}

const KIND_ICON = { INDIVIDUAL: 'bike', COMPANY: 'company', CENTRE: 'hubs' } as const
</script>

<template>
  <div v-if="data">
    <h1>Staff</h1>
    <div class="figures">
      <div><p class="n">{{ data.figures.waiting }}</p><p class="l">Waiting</p></div>
      <div><p class="n">{{ data.figures.moving }}</p><p class="l">On the road</p></div>
      <div><p class="n">{{ data.figures.atHub }}</p><p class="l">At centres</p></div>
      <div><p class="n">{{ data.figures.delivered }}</p><p class="l">Delivered</p></div>
    </div>

    <p v-if="error" class="error-text" role="alert" style="margin-bottom: 16px">{{ error }}</p>
    <p v-else-if="note" class="soft" style="margin-bottom: 16px">{{ note }}</p>

    <section v-if="data.applications.length" style="margin-bottom: 28px">
      <div class="label"><h2>To review</h2><span class="small faint">{{ data.applications.length }}</span></div>
      <ul class="list">
        <li v-for="a in data.applications" :key="a.id" class="item" style="grid-template-columns: 52px 1fr">
          <span class="item-icon"><AppIcon :name="KIND_ICON[a.kind]" /></span>
          <span class="stack" style="gap: 10px">
            <span>
              <b>{{ a.name }}</b>
              <span class="sub">{{ a.city }} · {{ a.detail }} · <a :href="`tel:${a.phone}`">{{ a.phone }}</a></span>
            </span>
            <span class="row" style="justify-content: flex-start">
              <button class="btn small" :disabled="busy" @click="decide(a.type, a.id, 'APPROVED')"><AppIcon name="check" />Approve</button>
              <button class="btn small quiet" :disabled="busy" @click="decide(a.type, a.id, 'REJECTED')">Reject</button>
            </span>
          </span>
        </li>
      </ul>
    </section>

    <section v-if="data.waitingForCourier" class="panel row" style="margin-bottom: 28px">
      <span>
        <b>{{ data.waitingForCourier }} at centres with no courier</b>
        <span class="sub soft small" style="display: block">Approve a courier in that city, or try again.</span>
      </span>
      <button class="btn small ink" :disabled="busy" @click="retryCouriers"><AppIcon name="refresh" />Try again</button>
    </section>

    <section v-if="data.attention.length" style="margin-bottom: 28px">
      <div class="label"><h2>Needs attention</h2></div>
      <ul class="list">
        <li v-for="a in data.attention" :key="a.kind + a.legId">
          <NuxtLink :to="`/parcels/${a.parcel.id}`" class="item">
            <span class="item-icon tone-alert"><AppIcon :name="a.kind === 'locked' ? 'lock' : 'alert'" /></span>
            <span>
              <b>{{ formatRef(a.parcel.number) }} · {{ a.carrier }}</b>
              <span class="sub">{{ a.since ? `Late since ${formatDateTime(a.since)}` : 'Locked after 5 wrong codes' }}</span>
            </span>
            <AppIcon name="chevron" />
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section>
      <div class="label"><h2>All parcels</h2><span class="small faint">{{ data.parcels.length }}</span></div>
      <ul v-if="data.parcels.length" class="list">
        <li v-for="p in data.parcels" :key="p.id">
          <NuxtLink :to="`/parcels/${p.id}`" class="item">
            <span class="item-icon" :class="{ ok: p.status === 'DELIVERED' }"><AppIcon :name="STATUS_ICON[p.status] ?? 'parcel'" /></span>
            <span>
              <b><span class="figure">{{ formatRef(p.number) }}</span> {{ p.fromCity }} → {{ p.toCity }}</b>
              <span class="sub">{{ PARCEL_STATUS[p.status as ParcelStatusName].label }} · {{ p.recipientName }}</span>
            </span>
            <AppIcon name="chevron" />
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="empty">No parcels yet.</p>
    </section>
  </div>
</template>
