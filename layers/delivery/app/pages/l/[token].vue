<script setup lang="ts">
// The carrier's job page. Opened from a WhatsApp link on a phone, no account.
definePageMeta({ public: true, layout: false })
useHead({ title: 'Your Posta job', meta: [{ name: 'robots', content: 'noindex' }] })

const token = useRoute().params.token as string
const jobs = useJob(token)
const { data: job } = await useApiData(`job:${token}`, () => jobs.load())
const { busy, error, run } = useSubmit()
const code = ref('')

const step = computed(() => (job.value!.status === 'ASSIGNED' ? 'collect' : job.value!.status === 'COLLECTED' ? 'handover' : 'done'))
const target = computed(() => (step.value === 'collect' ? job.value!.from : job.value!.to))
const firstName = computed(() => target.value.name.split(' ')[0])
const locked = computed(() => job.value!.attemptsLeft === 0)

async function confirm() {
  const updated = await run(() => jobs.act(step.value as 'collect' | 'handover', code.value))
  if (updated) {
    job.value = updated
    code.value = ''
  } else {
    job.value = await jobs.load() // a wrong code changes the attempts left
  }
}
</script>

<template>
  <main v-if="job" class="wrap">
    <header class="top">
      <span class="wordmark">posta<span>.</span></span>
      <span class="soft">{{ job.carrierName.split(' ')[0] }}</span>
    </header>

    <div v-if="step === 'done'" class="page" style="text-align: center; padding-top: 48px">
      <div class="hero-icon ok" style="margin-inline: auto"><AppIcon name="done" /></div>
      <h1>Handed over</h1>
      <p class="soft" style="margin-top: 8px">{{ job.to.name }}, {{ formatTime(job.handedOverAt!) }}. Thank you.</p>
    </div>

    <div v-else class="page">
      <div class="bar" style="margin-bottom: 24px"><i :style="{ width: step === 'collect' ? '50%' : '100%' }" /></div>
      <h1>{{ step === 'collect' ? 'Collect' : 'Hand over' }}</h1>
      <p class="soft" style="margin-top: 6px">{{ job.parcel.description }} · {{ job.parcel.weightKg }} kg</p>

      <section class="panel stack" style="margin-top: 22px">
        <div>
          <h2>{{ target.name }}</h2>
          <p class="postcode" style="margin-top: 4px">{{ target.postcode }}</p>
          <p class="soft small" style="display: flex; gap: 6px; align-items: center; margin-top: 6px">
            <AppIcon name="clock" />{{ step === 'collect' ? `Before ${formatDateTime(job.windowStart)}` : `By ${formatDateTime(job.windowEnd)}` }}
          </p>
        </div>
        <a v-if="target.phone" :href="`tel:${target.phone}`" class="btn quiet block"><AppIcon name="phone" />Call {{ firstName }}</a>

        <div v-if="locked" class="row tone-alert" style="justify-content: flex-start; padding-top: 6px">
          <AppIcon name="lock" style="font-size: 26px; flex: none" />
          <p>Locked. Call Posta.</p>
        </div>

        <form v-else class="stack" style="padding-top: 6px" @submit.prevent="confirm">
          <label class="field-label" for="code" style="margin: 0">Code from {{ firstName }}</label>
          <input
            id="code"
            v-model="code"
            class="code-input"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="\d{6}"
            maxlength="6"
            placeholder="000000"
          />
          <p v-if="error" class="error-text" role="alert">{{ error }}</p>
          <button class="btn block" :disabled="busy || code.length !== 6">
            <AppIcon name="check" />{{ busy ? 'Checking…' : step === 'collect' ? 'Collected' : 'Handed over' }}
          </button>
        </form>
      </section>
    </div>
  </main>
</template>
