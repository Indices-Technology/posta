<script setup lang="ts">
// The recipient's tracking page. Holds their delivery code, so it lives behind an unguessable link.
definePageMeta({ public: true, layout: false })
useHead({ title: 'Track your parcel · Posta', meta: [{ name: 'robots', content: 'noindex' }] })

const token = useRoute().params.token as string
const { data: t } = await useFetch(`/api/track/${token}`)
if (!t.value) throw createError({ statusCode: 404, statusMessage: 'Tracking link not found', fatal: true })

const STAGE: Record<string, number> = { NEW: 0, MATCHED: 0, IN_TRANSIT: 1, AT_HUB: 2, OUT_FOR_DELIVERY: 3, DELIVERED: 4 }
const stage = computed(() => STAGE[t.value!.status] ?? 0)
const labels = ['On the road', 'At hub', 'Out for delivery', 'Delivered']
const delivered = computed(() => t.value!.status === 'DELIVERED')
</script>

<template>
  <main v-if="t" class="public">
    <div class="public-top">
      <span class="wordmark">posta<span>.</span></span>
      <span class="small faint">Parcel <span class="figure">{{ formatRef(t.number) }}</span></span>
    </div>

    <p class="small soft">Hi {{ t.recipientFirstName }}, your parcel from {{ t.fromCity }} is</p>
    <h1 style="margin-top: 4px" :class="{ 'tone-ok': delivered }">{{ PARCEL_STATUS[t.status as ParcelStatusName].label }}</h1>

    <div style="margin: 22px 0 32px">
      <div class="progress" :class="{ ok: delivered }"><i :style="{ width: `${(stage / 4) * 100}%` }" /></div>
      <div class="steps">
        <span v-for="(l, i) in labels" :key="l" :class="{ on: stage >= i + 1 }" :style="{ textAlign: i === 3 ? 'right' : i === 0 ? 'left' : 'center' }">{{ l }}</span>
      </div>
    </div>

    <section v-if="t.deliveryCode" class="panel section">
      <p class="small soft" style="font-weight: 700">Your delivery code</p>
      <p class="big-code" style="margin: 10px 0 12px">{{ formatCode(t.deliveryCode) }}</p>
      <p class="small soft">Give it to the courier only when the parcel is in your hands. It is how we know you received it.</p>
      <div v-if="t.courier" class="row" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line)">
        <div>
          <p class="small faint">Courier</p>
          <p class="row-title">{{ t.courier.name }}</p>
        </div>
        <a :href="`tel:${t.courier.phone}`" class="btn quiet small"><AppIcon name="phone" />Call</a>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Updates</h2></div>
      <ul class="timeline">
        <li v-for="e in [...t.events].reverse()" :key="e.id">
          <time>{{ formatDateTime(e.at) }}</time>
          <span>{{ e.text }}</span>
        </li>
      </ul>
    </section>
  </main>
</template>
