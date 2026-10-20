<script setup lang="ts">
// The recipient's tracking page (no account). Their QR shows when it's their turn: the courier is at
// the door, or the parcel is ready at the centre they collect from.
definePageMeta({ public: true, layout: false })
useHead({ title: 'Your parcel', meta: [{ name: 'robots', content: 'noindex' }] })

const token = useRoute().params.token as string
const delivery = useDelivery()
const { data: t, refresh } = await useApiData(`track:${token}`, () => delivery.getTracking(token))

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(() => t.value?.status !== 'DELIVERED' && refresh(), 20_000)))
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <main v-if="t" class="wrap">
    <header class="top">
      <NuxtLink to="/" class="wordmark">posta<span>.</span></NuxtLink>
      <span class="figure soft">{{ formatRef(t.number) }}</span>
    </header>

    <div class="page">
      <p class="soft">Hi {{ t.recipientFirstName }}, your parcel from {{ t.fromCity }} is</p>
      <h1 style="margin-top: 4px" :class="{ 'tone-ok': t.status === 'DELIVERED' }">{{ PARCEL_STATUS[t.status as ParcelStatusName]?.label ?? t.status }}</h1>

      <section v-if="t.yourQr" class="panel stack" style="margin-top: 18px">
        <h2 v-if="t.collectAt">Collect at {{ t.collectAt.name }}</h2>
        <h2 v-else>Your courier is coming</h2>
        <HandoverQr :token="t.yourQr.token" :code="t.yourQr.code" :to="t.collectAt ? 'the centre' : t.courier ? firstName(t.courier.name) : 'the courier'" />
        <p class="small soft" style="text-align: center">Only once the parcel is in your hands.</p>
      </section>

      <section v-if="t.collectAt && t.status !== 'DELIVERED'" class="panel stack" :style="{ marginTop: t.yourQr ? '12px' : '18px' }">
        <div class="row" style="justify-content: flex-start; gap: 14px">
          <span class="item-icon"><AppIcon name="hubs" /></span>
          <span>
            <b>{{ t.collectAt.name }}</b>
            <span class="sub soft" style="display: block"><span class="mono">{{ t.collectAt.postcode }}</span><template v-if="t.collectAt.address"> · {{ t.collectAt.address }}</template></span>
            <span v-if="t.collectAt.hours" class="sub soft" style="display: block">{{ t.collectAt.hours }}</span>
          </span>
        </div>
      </section>

      <a v-if="t.courier && !t.collectAt && t.status !== 'DELIVERED'" :href="`tel:${t.courier.phone}`" class="btn quiet block" style="margin-top: 12px">
        <AppIcon name="phone" />Call {{ firstName(t.courier.name) }}
      </a>

      <JourneyMap v-if="t.journey" :journey="t.journey" />
      <StageBar :status="t.status" />

      <details class="more" style="margin-top: 24px">
        <summary>Updates <AppIcon name="chevron" /></summary>
        <ul class="timeline" style="margin-top: 8px">
          <li v-for="e in [...t.events].reverse()" :key="e.id">
            <time>{{ formatDateTime(e.at) }}</time><span>{{ e.text }}</span>
          </li>
        </ul>
      </details>
    </div>
  </main>
</template>
