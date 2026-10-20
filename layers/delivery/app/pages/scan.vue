<script setup lang="ts">
/**
 * Scan a handover QR. Uses the phone's built-in barcode reader where the browser has one (Android
 * Chrome); elsewhere (iPhone Safari) the normal camera app reads the QR and opens the same link.
 * Typing the 6-digit code always works. `?job=` carries a carrier's job link (no account needed).
 */
definePageMeta({ public: true, layout: false })
useHead({ title: 'Scan' })

const route = useRoute()
const job = computed(() => (typeof route.query.job === 'string' ? route.query.job : null))
const back = computed(() => (job.value ? `/l/${job.value}` : '/'))
const { confirmCode } = useHandovers()
const { busy, error, run } = useSubmit()

const video = ref<HTMLVideoElement | null>(null)
const canScan = ref(false)
const camError = ref('')
const code = ref('')
const done = ref<{ ref: string } | null>(null)
let stream: MediaStream | null = null
let timer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  const Detector = (window as any).BarcodeDetector
  if (!Detector) return
  try {
    const detector = new Detector({ formats: ['qr_code'] })
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    canScan.value = true
    await nextTick()
    video.value!.srcObject = stream
    await video.value!.play()
    timer = setInterval(async () => {
      const [hit] = await detector.detect(video.value!).catch(() => [])
      const token = hit ? tokenFromScan(hit.rawValue) : null
      if (token) {
        clearInterval(timer)
        await navigateTo({ path: `/h/${token}`, query: job.value ? { job: job.value } : {} })
      }
    }, 300)
  } catch {
    camError.value = 'Camera not available. Type the code instead.'
  }
})

onBeforeUnmount(() => {
  clearInterval(timer)
  stream?.getTracks().forEach((t) => t.stop())
})

async function submitCode() {
  const res = await run(() => confirmCode(code.value, job.value))
  if (res) done.value = { ref: res.ref }
}
</script>

<template>
  <main class="wrap">
    <header class="top">
      <BackButton :to="back" style="margin-left: -12px" />
      <NuxtLink to="/" class="wordmark">posta<span>.</span></NuxtLink>
    </header>

    <div v-if="done" class="page" style="text-align: center; padding-top: 40px">
      <div class="hero-icon ok" style="margin-inline: auto"><AppIcon name="done" /></div>
      <h1>Done</h1>
      <p class="soft" style="margin-top: 8px">{{ done.ref }} is recorded.</p>
      <NuxtLink :to="back" class="btn ink block" style="margin-top: 28px">Back</NuxtLink>
    </div>

    <div v-else class="page stack">
      <h1>Scan their code</h1>

      <div v-if="canScan" class="viewer">
        <video ref="video" playsinline muted />
        <span class="frame" aria-hidden="true" />
      </div>
      <section v-else class="panel stack">
        <div class="hero-icon" style="margin: 0"><AppIcon name="qr" /></div>
        <p>{{ camError || "Open your phone's camera and point it at their QR. It opens here." }}</p>
      </section>

      <form class="stack" style="margin-top: 8px" @submit.prevent="submitCode">
        <label class="field-label" for="code" style="margin: 0">Or type the 6-digit code</label>
        <input id="code" v-model="code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000 000" />
        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
        <button class="btn block" :disabled="busy || code.replace(/\D/g, '').length !== 6">
          <AppIcon name="check" />{{ busy ? 'Checking…' : 'Confirm' }}
        </button>
      </form>
    </div>
  </main>
</template>

<style scoped>
.viewer { position: relative; border-radius: 16px; overflow: hidden; background: #000; aspect-ratio: 1; }
.viewer video { width: 100%; height: 100%; object-fit: cover; }
.frame { position: absolute; inset: 18%; border: 3px solid #fff; border-radius: 16px; box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.35); }
</style>
