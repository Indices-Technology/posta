<script setup lang="ts">
// A carrier's job (traveller or courier), opened from their link, no account needed:
// collect (scan the giver's QR, or show yours to a centre) and deliver (the same, the other way).
definePageMeta({ public: true, layout: false })
useHead({ title: 'Your Posta job', meta: [{ name: 'robots', content: 'noindex' }] })

const token = useRoute().params.token as string
const jobs = useJob(token)
const { data: job, refresh } = await useApiData(`job:${token}`, () => jobs.load())

const current = computed(() => job.value?.steps.find((s) => s.status === 'READY'))
const allDone = computed(() => !!job.value?.steps.length && job.value.steps.every((s) => s.status === 'DONE'))

// The other side scans the carrier's QR on their own phone: check now and then for that.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(() => !allDone.value && refresh(), 10_000)))
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <main v-if="job" class="wrap">
    <header class="top">
      <NuxtLink to="/" class="wordmark">posta<span>.</span></NuxtLink>
      <span class="soft">{{ job.carrierName?.split(' ')[0] }}</span>
    </header>

    <div v-if="allDone" class="page" style="text-align: center; padding-top: 48px">
      <div class="hero-icon ok" style="margin-inline: auto"><AppIcon name="done" /></div>
      <h1>Job done</h1>
      <p class="soft" style="margin-top: 8px">{{ job.ref }} handed over. Thank you.</p>
    </div>

    <div v-else class="page">
      <p class="soft">{{ job.kind === 'LINEHAUL' ? 'Trip' : 'Courier job' }} · {{ job.ref }}</p>
      <h1 style="margin-top: 2px">{{ current?.kind === 'deliver' ? 'Hand over' : 'Collect' }}</h1>
      <p class="soft" style="margin-top: 6px">{{ job.contents }} · {{ job.weightKg }} kg</p>

      <ol class="list" style="margin-top: 18px">
        <li v-for="s in job.steps" :key="s.seq">
          <section class="step" :class="{ now: s.status === 'READY', done: s.status === 'DONE' }">
            <div class="row" style="align-items: flex-start">
              <span>
                <span class="small soft" style="font-weight: 700">{{ s.kind === 'collect' ? 'Collect from' : 'Hand to' }}</span>
                <b style="display: block; font-size: 19px">{{ s.with.name }}</b>
                <span v-if="s.with.postcode" class="mono small">{{ s.with.postcode }}</span>
                <span v-if="s.with.address" class="small soft" style="display: block">{{ s.with.address }}</span>
                <span v-if="s.with.hours" class="small soft" style="display: block">{{ s.with.hours }}</span>
              </span>
              <AppIcon v-if="s.status === 'DONE'" name="done" class="tone-ok" style="font-size: 28px; flex: none" />
              <a v-else-if="s.with.phone" :href="`tel:${s.with.phone}`" class="iconbtn" :aria-label="`Call ${s.with.name}`"><AppIcon name="phone" /></a>
            </div>

            <p v-if="s.status === 'DONE'" class="small soft">Done {{ formatDateTime(s.doneAt!) }}</p>
            <p v-else-if="s.status === 'WAITING'" class="small soft">After the step before it.</p>
            <template v-else-if="s.locked">
              <p class="tone-alert">Locked after too many wrong codes. Call Posta.</p>
            </template>
            <template v-else-if="s.action === 'scan'">
              <NuxtLink :to="{ path: '/scan', query: { job: token } }" class="btn block"><AppIcon name="scan" />Scan their code</NuxtLink>
            </template>
            <HandoverQr v-else-if="s.qr" :token="s.qr.token" :code="s.qr.code" :to="s.with.name" />
          </section>
        </li>
      </ol>
    </div>
  </main>
</template>

<style scoped>
.step { display: grid; gap: 14px; padding: 18px 0; }
.step.now { padding: 18px; margin: 8px 0; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.step.done b { color: var(--ink-soft); }
</style>
