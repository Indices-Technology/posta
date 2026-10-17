<script setup lang="ts">
// My work with Posta: courier / company status, open jobs, and centres I registered.
useHead({ title: 'My work · Posta' })
const courier = useCourier()
const hubs = useHubs()
const { data } = await useApiData('my-work', async () => {
  const [couriers, centres] = await Promise.all([courier.mine(), hubs.mine()])
  return { couriers, centres }
})

const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'Under review', tone: 'tone-neutral' },
  APPROVED: { label: 'Approved', tone: 'tone-ok' },
  REJECTED: { label: 'Not approved', tone: 'tone-neutral' },
  SUSPENDED: { label: 'Paused', tone: 'tone-alert' },
}
const jobs = computed(() => data.value?.couriers.flatMap((c) => c.jobs) ?? [])
const nothing = computed(() => !data.value?.couriers.length && !data.value?.centres.length)
</script>

<template>
  <div v-if="data">
    <NuxtLink to="/" class="iconbtn" aria-label="Home" style="margin-left: -12px"><AppIcon name="back" /></NuxtLink>
    <h1 style="margin: 8px 0 20px">My work</h1>

    <section v-if="nothing" class="panel" style="text-align: center">
      <div class="hero-icon" style="margin-inline: auto"><AppIcon name="work" /></div>
      <h2>Not working with Posta yet</h2>
      <NuxtLink to="/join" class="btn block" style="margin-top: 20px">See how</NuxtLink>
    </section>

    <section v-if="jobs.length" style="margin-bottom: 28px">
      <div class="label"><h2>Jobs</h2></div>
      <ul class="list">
        <li v-for="j in jobs" :key="j.legId" class="item">
          <span class="item-icon"><AppIcon :name="j.status === 'COLLECTED' ? 'road' : 'parcel'" /></span>
          <span>
            <b>{{ j.ref }} · {{ j.contents }}</b>
            <span class="sub">{{ j.status === 'COLLECTED' ? 'With you' : 'To collect' }} · by {{ formatDateTime(j.by) }}</span>
          </span>
          <NuxtLink :to="`/l/${j.linkToken}`" class="btn small ink">Open</NuxtLink>
        </li>
      </ul>
    </section>

    <section v-if="data.couriers.length || data.centres.length">
      <div class="label"><h2>Applications</h2></div>
      <ul class="list">
        <li v-for="c in data.couriers" :key="c.id" class="item">
          <span class="item-icon"><AppIcon :name="c.kind === 'COMPANY' ? 'company' : c.vehicle === 'CAR' ? 'car' : c.vehicle === 'VAN' ? 'van' : 'bike'" /></span>
          <span>
            <b>{{ c.name }}</b>
            <span class="sub">{{ c.kind === 'COMPANY' ? 'Courier company' : 'Courier' }} · {{ c.city }}</span>
          </span>
          <span class="status" :class="STATUS[c.status]?.tone"><i class="dot" />{{ STATUS[c.status]?.label }}</span>
        </li>
        <li v-for="h in data.centres" :key="h.id" class="item">
          <span class="item-icon"><AppIcon name="hubs" /></span>
          <span>
            <b>{{ h.name }}</b>
            <span class="sub">Fulfilment centre · {{ h.city }}</span>
          </span>
          <span class="status" :class="STATUS[h.status]?.tone"><i class="dot" />{{ STATUS[h.status]?.label }}</span>
        </li>
      </ul>
    </section>

    <!-- Companies connecting their own system: what they need, shown only to them. -->
    <details v-for="c in data.couriers.filter((x) => x.webhookUrl)" :key="`wh-${c.id}`" class="more" style="margin-top: 24px">
      <summary>{{ c.name }}: system connection <AppIcon name="system" /></summary>
      <ul class="facts" style="margin-top: 8px">
        <li><AppIcon name="link" /><span class="mono small" style="word-break: break-all">{{ c.webhookUrl }}</span></li>
        <li><AppIcon name="lock" /><span class="mono small" style="word-break: break-all">{{ c.webhookSecret }}</span></li>
      </ul>
      <p class="small soft" style="margin-top: 8px">
        Each new job is POSTed to your address with an <span class="mono">x-posta-signature</span> header. Check it with this secret
        and ignore any <span class="mono">id</span> you have already handled.
      </p>
    </details>
  </div>
</template>
