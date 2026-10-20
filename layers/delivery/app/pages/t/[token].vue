<script setup lang="ts">
// The recipient's tracking page. Holds their delivery code, so it lives behind an unguessable link.
definePageMeta({ public: true, layout: false })
useHead({ title: 'Your parcel · Posta', meta: [{ name: 'robots', content: 'noindex' }] })

const token = useRoute().params.token as string
const delivery = useDelivery()
const { data: t } = await useApiData(`track:${token}`, () => delivery.getTracking(token))
</script>

<template>
  <main v-if="t" class="wrap">
    <header class="top">
      <span class="wordmark">posta<span>.</span></span>
      <span class="figure soft">{{ formatRef(t.number) }}</span>
    </header>

    <div class="page">
      <p class="soft">From {{ t.fromCity }}</p>
      <h1 style="margin-top: 4px" :class="{ 'tone-ok': t.status === 'DELIVERED' }">{{ PARCEL_STATUS[t.status as ParcelStatusName].label }}</h1>

      <JourneyMap v-if="t.journey" :journey="t.journey" />
      <StageBar :status="t.status" />

      <section v-if="t.deliveryCode" class="panel stack">
        <p class="soft" style="font-weight: 700">Your code. Give it to the courier when you have the parcel.</p>
        <p class="big-code">{{ formatCode(t.deliveryCode) }}</p>
        <a v-if="t.courier" :href="`tel:${t.courier.phone}`" class="btn quiet block"><AppIcon name="phone" />Call {{ t.courier.name.split(' ')[0] }}</a>
      </section>

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
