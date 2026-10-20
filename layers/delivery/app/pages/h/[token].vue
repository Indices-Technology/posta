<script setup lang="ts">
/**
 * Opened by scanning a handover QR (with our scanner, or any phone camera). Shows only what this
 * handover needs, and a confirm button for the one person who may confirm it.
 */
definePageMeta({ public: true, layout: false })
useHead({ title: 'Handover', meta: [{ name: 'robots', content: 'noindex' }] })

const route = useRoute()
const token = route.params.token as string
const job = typeof route.query.job === 'string' ? route.query.job : null
const handovers = useHandovers()
const { data, refresh } = await useApiData(`handover:${token}`, () => handovers.view(token, job))
const { busy, error, run } = useSubmit()

const toRecipient = computed(() => data.value?.to.party === 'RECIPIENT')
const back = job ? `/l/${job}` : '/'

async function confirm() {
  if (await run(() => handovers.confirm(token, job))) await refresh()
}
</script>

<template>
  <main v-if="data" class="wrap">
    <header class="top">
      <BackButton :to="back" style="margin-left: -12px" />
      <span class="figure soft">{{ data.ref }}</span>
    </header>

    <div class="page stack">
      <div v-if="data.status === 'DONE'" style="text-align: center; padding-top: 24px">
        <div class="hero-icon ok" style="margin-inline: auto"><AppIcon name="done" /></div>
        <h1>{{ toRecipient ? 'Delivered' : 'Handed over' }}</h1>
        <p class="soft" style="margin-top: 8px">{{ data.from.name }} to {{ data.to.name }}, {{ formatDateTime(data.doneAt!) }}.</p>
        <NuxtLink :to="back" class="btn ink block" style="margin-top: 28px">Back</NuxtLink>
      </div>

      <template v-else>
        <h1>{{ toRecipient ? 'Hand it over' : 'Take the parcel' }}</h1>
        <section class="panel stack">
          <div class="row" style="justify-content: flex-start; gap: 14px">
            <span class="item-icon"><AppIcon name="parcel" /></span>
            <span><b>{{ data.contents }}</b><span class="sub soft" style="display: block">{{ data.weightKg }} kg · {{ data.ref }}</span></span>
          </div>
          <ul class="facts">
            <li><AppIcon name="user" /><span><span class="soft small">From</span><br /><b>{{ data.from.name }}</b></span></li>
            <li><AppIcon name="arrow" /><span><span class="soft small">To</span><br /><b>{{ data.to.name }}</b></span></li>
          </ul>
        </section>

        <template v-if="data.youConfirm">
          <p v-if="data.status !== 'READY'" class="soft">Not yet: an earlier step is still open.</p>
          <p v-if="error" class="error-text" role="alert">{{ error }}</p>
          <button class="btn block" :disabled="busy || data.status !== 'READY'" @click="confirm">
            <AppIcon name="check" />{{ busy ? 'Confirming…' : toRecipient ? `${data.to.name} has it` : 'I have it' }}
          </button>
        </template>
        <NuxtLink v-else-if="data.needsSignIn" :to="{ path: '/login', query: { next: route.fullPath } }" class="btn block">Sign in to confirm</NuxtLink>
        <p v-else class="soft">This code is for {{ toRecipient ? data.from.name : data.to.name }} to scan.</p>
      </template>
    </div>
  </main>
</template>
