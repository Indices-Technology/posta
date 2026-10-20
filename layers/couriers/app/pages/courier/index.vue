<script setup lang="ts">
// The courier dashboard: the "I'm available" switch, job offers to answer, jobs in progress,
// and my applications (courier, company, fulfilment centre).
useHead({ title: 'My work' })
const courier = useCourier()
const hubs = useHubs()
const { data, refresh } = await useApiData('my-work', async () => {
  const [board, couriers, centres] = await Promise.all([courier.dashboard(), courier.mine(), hubs.mine()])
  return { board, couriers, centres }
})
const { busy, error, run } = useSubmit()

const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'Under review', tone: 'tone-neutral' },
  APPROVED: { label: 'Approved', tone: 'tone-ok' },
  REJECTED: { label: 'Not approved', tone: 'tone-neutral' },
  SUSPENDED: { label: 'Paused', tone: 'tone-alert' },
}

const person = computed(() => data.value?.board.profiles.find((p) => p.kind === 'INDIVIDUAL' && p.status === 'APPROVED'))
const nothing = computed(() => !data.value?.couriers.length && !data.value?.centres.length)

// Offers expire in about 2 minutes: count down, and look for new ones while available.
const now = ref(Date.now())
const left = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - now.value) / 1000))
let tick: ReturnType<typeof setInterval> | undefined
let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  tick = setInterval(() => (now.value = Date.now()), 1000)
  poll = setInterval(() => person.value?.available && refresh(), 10_000)
})
onBeforeUnmount(() => {
  clearInterval(tick)
  clearInterval(poll)
})

async function toggle() {
  if (await run(() => courier.setAvailability(!person.value?.available))) await refresh()
}
async function accept(id: string) {
  const res = await run(() => courier.accept(id))
  if (res) await navigateTo(`/l/${res.linkToken}`)
}
async function decline(id: string) {
  await run(() => courier.decline(id))
  if (!error.value) await refresh()
}
</script>

<template>
  <div v-if="data">
    <BackButton style="margin-left: -12px" />
    <h1 style="margin: 8px 0 20px">My work</h1>

    <section v-if="nothing" class="panel" style="text-align: center">
      <div class="hero-icon" style="margin-inline: auto"><AppIcon name="work" /></div>
      <h2>Not working with Posta yet</h2>
      <NuxtLink to="/join" class="btn block" style="margin-top: 20px">See how</NuxtLink>
    </section>

    <!-- The switch -->
    <button v-if="person" type="button" class="switch" :class="{ on: person.available }" :disabled="busy" @click="toggle">
      <AppIcon name="bike" />
      <span>
        <b>{{ person.available ? "I'm available" : "I'm offline" }}</b>
        <span class="small">{{ person.available ? `Taking jobs in ${person.city}. Tap to stop.` : 'Tap to start taking jobs' }}</span>
      </span>
      <i class="knob" aria-hidden="true" />
    </button>
    <p v-if="error" class="error-text" role="alert" style="margin-top: 10px">{{ error }}</p>

    <section v-if="data.board.offers.length" style="margin-top: 24px">
      <div class="label"><h2>New jobs</h2></div>
      <div v-for="o in data.board.offers" :key="o.id" class="panel stack" style="margin-bottom: 12px">
        <div class="row">
          <b>{{ o.ref }} · {{ o.contents }}</b>
          <span class="status tone-alert"><AppIcon name="timer" />{{ left(o.expiresAt) }}s</span>
        </div>
        <p class="small soft">
          {{ o.kind === 'FIRST_MILE' ? 'Pick up' : 'Collect' }} at <span class="mono">{{ o.from }}</span>, take to <span class="mono">{{ o.to }}</span> · {{ o.weightKg }} kg
        </p>
        <div class="row">
          <button class="btn quiet small" :disabled="busy" @click="decline(o.id)">Pass</button>
          <button class="btn" style="flex: 1" :disabled="busy || !left(o.expiresAt)" @click="accept(o.id)"><AppIcon name="check" />Accept</button>
        </div>
      </div>
    </section>

    <section v-if="data.board.jobs.length" style="margin-top: 24px">
      <div class="label"><h2>Jobs</h2></div>
      <ul class="list">
        <li v-for="j in data.board.jobs" :key="j.legId" class="item">
          <span class="item-icon"><AppIcon :name="j.status === 'COLLECTED' ? 'road' : 'parcel'" /></span>
          <span>
            <b>{{ j.ref }} · {{ j.contents }}</b>
            <span class="sub">{{ j.status === 'COLLECTED' ? 'With you' : 'To collect' }} · by {{ formatDateTime(j.by) }}</span>
          </span>
          <NuxtLink :to="`/l/${j.linkToken}`" class="btn small ink">Open</NuxtLink>
        </li>
      </ul>
    </section>

    <section v-if="data.couriers.length || data.centres.length" style="margin-top: 24px">
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
        <li v-for="h in data.centres" :key="h.id">
          <NuxtLink :to="h.status === 'APPROVED' ? '/centre' : '/courier'" class="item">
            <span class="item-icon"><AppIcon name="hubs" /></span>
            <span>
              <b>{{ h.name }}</b>
              <span class="sub">Fulfilment centre · {{ h.city }}</span>
            </span>
            <span class="status" :class="STATUS[h.status]?.tone"><i class="dot" />{{ STATUS[h.status]?.label }}</span>
          </NuxtLink>
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

<style scoped>
.switch {
  display: grid; grid-template-columns: 44px 1fr 56px; align-items: center; gap: 14px; width: 100%;
  padding: 18px; border-radius: 16px; border: 1.5px solid var(--line-strong); background: var(--surface); cursor: pointer; text-align: left;
}
.switch > .iconify { font-size: 36px; color: var(--ink-faint); }
.switch b { display: block; font: 750 19px var(--font-display); }
.switch .small { color: var(--ink-soft); }
.knob { position: relative; width: 56px; height: 32px; border-radius: 999px; background: var(--line-strong); transition: background 0.2s; }
.knob::after { content: ''; position: absolute; top: 4px; left: 4px; width: 24px; height: 24px; border-radius: 50%; background: #fff; transition: transform 0.2s; }
.switch.on { border-color: var(--ok); }
.switch.on > .iconify { color: var(--ok); }
.switch.on .knob { background: var(--ok); }
.switch.on .knob::after { transform: translateX(24px); }
</style>
