<script setup lang="ts">
// The carrier's job page. Opened from a WhatsApp link on a phone, no account.
definePageMeta({ public: true, layout: false })
useHead({ title: 'Your Posta job', meta: [{ name: 'robots', content: 'noindex' }] })

const token = useRoute().params.token as string
const url: string = `/api/legs/${token}`
const { data: job } = await useFetch(`/api/legs/${token}`)
if (!job.value) throw createError({ statusCode: 404, statusMessage: 'This job link is not valid', fatal: true })
type Job = NonNullable<typeof job.value>

const code = ref('')
const busy = ref(false)
const error = ref('')

const step = computed(() => (job.value!.status === 'ASSIGNED' ? 'collect' : job.value!.status === 'COLLECTED' ? 'handover' : 'done'))
const target = computed(() => (step.value === 'collect' ? job.value!.from : job.value!.to))
const firstName = computed(() => target.value.name.split(' ')[0])
const locked = computed(() => job.value!.attemptsLeft === 0)

async function confirm() {
  error.value = ''
  busy.value = true
  try {
    job.value = await $fetch<Job>(url, { method: 'POST', body: { action: step.value, code: code.value } })
    code.value = ''
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not confirm. Check your signal and try again.'
    if (e?.statusCode === 422) job.value = await $fetch<Job>(url) // attempts left changed
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main v-if="job" class="public">
    <div class="public-top">
      <span class="wordmark">posta<span>.</span></span>
      <span class="small faint">Job for {{ job.carrierName }}</span>
    </div>

    <p class="small soft">{{ job.kind === 'LINEHAUL' ? 'Driver' : 'Courier' }} job</p>
    <h1 style="margin-top: 2px">
      Parcel <span class="figure">{{ formatRef(job.parcel.number) }}</span>
    </h1>
    <p class="soft" style="margin-top: 4px">{{ job.parcel.description }} · {{ job.parcel.weightKg }} kg</p>

    <ol class="journey" style="margin-top: 28px">
      <li :class="{ done: step !== 'collect', now: step === 'collect' }">
        <i class="mark" />
        <p class="row-title">Collect</p>
        <p v-if="job.collectedAt" class="row-sub">Collected {{ formatDateTime(job.collectedAt) }}</p>
        <p v-else class="row-sub">{{ job.from.name }}, <span class="mono">{{ job.from.postcode }}</span></p>
      </li>
      <li :class="{ done: step === 'done', now: step === 'handover' }">
        <i class="mark" />
        <p class="row-title">Hand over</p>
        <p v-if="job.handedOverAt" class="row-sub">Handed over {{ formatDateTime(job.handedOverAt) }}</p>
        <p v-else class="row-sub">{{ job.to.name }}, <span class="mono">{{ job.to.postcode }}</span></p>
      </li>
    </ol>

    <section v-if="step === 'done'" class="panel" style="text-align: center; padding: 32px 20px">
      <AppIcon name="done" class="tone-ok" style="font-size: 48px" />
      <h2 style="margin-top: 12px; font-size: 20px">Handed over</h2>
      <p class="soft" style="margin-top: 6px">{{ job.to.name }}, {{ formatTime(job.handedOverAt!) }}. Thank you, {{ job.carrierName.split(' ')[0] }}. Nothing else to do.</p>
    </section>

    <section v-else class="panel">
      <p class="small soft" style="font-weight: 700">{{ step === 'collect' ? 'Collect from' : 'Hand over to' }}</p>
      <div class="place" style="margin-top: 6px">
        <h2 style="font-size: 20px">{{ target.name }}</h2>
        <a v-if="target.phone" :href="`tel:${target.phone}`" class="btn quiet small" style="grid-row: span 2"><AppIcon name="phone" />Call</a>
        <p class="postcode">{{ target.postcode }}</p>
      </div>
      <p class="small soft" style="display: flex; gap: 6px; align-items: center; margin-top: 8px">
        <AppIcon name="clock" />
        {{ step === 'collect' ? `Before ${formatDateTime(job.windowStart)}` : `By ${formatDateTime(job.windowEnd)}` }}
      </p>

      <div v-if="locked" style="margin-top: 20px; display: flex; gap: 10px; align-items: flex-start" class="tone-alert">
        <AppIcon name="lock" style="font-size: 22px; flex: none" />
        <p>This job is locked after too many wrong codes. Call Posta to unlock it.</p>
      </div>

      <form v-else style="margin-top: 22px; display: grid; gap: 12px" @submit.prevent="confirm">
        <label class="field">
          <span>Code from {{ firstName }}</span>
          <input
            v-model="code"
            class="code-input"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="\d{6}"
            maxlength="6"
            placeholder="000000"
            aria-describedby="code-help"
          />
        </label>
        <p id="code-help" class="small faint">
          {{ step === 'collect' ? `Ask ${firstName} for their 6-digit code once the parcel is in your hands.` : `Ask ${firstName} for their code once they have the parcel.` }}
        </p>
        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
        <button class="btn block" :disabled="busy || code.length !== 6">
          {{ busy ? 'Confirming…' : step === 'collect' ? 'Confirm collection' : 'Confirm handover' }}
        </button>
      </form>
    </section>
  </main>
</template>
