<script setup lang="ts">
useHead({ title: 'Overview · Posta' })
const { data } = await useFetch('/api/overview')

const setupSteps = computed(() => {
  const s = data.value?.setup
  if (!s) return []
  return [
    { done: s.hubs > 0, title: 'Handover points', sub: `${s.hubs} set up`, to: '/hubs' },
    { done: s.trips > 0, title: 'Post a trip', sub: 'Someone driving between two cities', to: '/trips/new' },
    { done: s.parcels > 0, title: 'Book a parcel', sub: 'It rides on the first matching trip', to: '/parcels/new' },
  ]
})
</script>

<template>
  <div v-if="data">
    <div class="page-head">
      <div>
        <h1>Overview</h1>
        <p class="sub">{{ formatDay(new Date()) }}</p>
      </div>
      <NuxtLink to="/parcels/new" class="btn"><AppIcon name="add" />Book a parcel</NuxtLink>
    </div>

    <section v-if="data.setup.parcels === 0" class="section">
      <div class="section-head"><h2>Getting started</h2></div>
      <ol class="rows">
        <li v-for="(step, i) in setupSteps" :key="step.to">
          <NuxtLink :to="step.to" class="row-link" style="--cols: 28px 1fr auto">
            <AppIcon v-if="step.done" name="done" class="tone-ok" style="font-size: 22px" />
            <span v-else class="figure faint">{{ i + 1 }}</span>
            <div>
              <p class="row-title">{{ step.title }}</p>
              <p class="row-sub">{{ step.sub }}</p>
            </div>
            <AppIcon name="chevron" class="faint" />
          </NuxtLink>
        </li>
      </ol>
    </section>

    <div class="figures">
      <NuxtLink to="/parcels?view=waiting"><p class="n">{{ data.figures.waiting }}</p><p class="l">Waiting for a trip</p></NuxtLink>
      <NuxtLink to="/parcels?view=moving"><p class="n">{{ data.figures.moving }}</p><p class="l">On the road</p></NuxtLink>
      <NuxtLink to="/parcels?view=moving"><p class="n">{{ data.figures.atHub }}</p><p class="l">At handover points</p></NuxtLink>
      <NuxtLink to="/parcels?view=delivered"><p class="n">{{ data.figures.delivered }}</p><p class="l">Delivered</p></NuxtLink>
    </div>

    <div class="split">
      <div>
        <section v-if="data.attention.length" class="section">
          <div class="section-head"><h2>Needs attention</h2><span class="count">{{ data.attention.length }}</span></div>
          <ul class="rows">
            <li v-for="a in data.attention" :key="a.kind + a.legId">
              <NuxtLink :to="`/parcels/${a.parcel.id}`" class="row-link" style="--cols: 1fr auto">
                <div>
                  <p class="row-title">{{ formatRef(a.parcel.number) }} · {{ a.carrier }}</p>
                  <p class="row-sub">
                    {{ a.kind === 'locked' ? 'Locked after 5 wrong codes' : `Overdue since ${formatDateTime(a.since!)}` }}
                  </p>
                </div>
                <span class="status tone-alert"><i class="dot" />{{ a.kind === 'locked' ? 'Locked' : 'Late' }}</span>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <section class="section">
          <div class="section-head"><h2>Waiting for a trip</h2><span class="count">{{ data.figures.waiting }}</span></div>
          <ul v-if="data.waiting.length" class="rows">
            <li v-for="p in data.waiting" :key="p.id">
              <NuxtLink :to="`/parcels/${p.id}`" class="row-link" style="--cols: 1fr auto">
                <div>
                  <p class="row-title">{{ formatRef(p.number) }}</p>
                  <p class="row-sub">{{ p.fromCity }} to {{ p.toCity }}</p>
                </div>
                <span class="small faint">Booked {{ formatDay(p.createdAt) }}</span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="empty">Every parcel has a trip.</p>
        </section>
      </div>

      <section class="section">
        <div class="section-head"><h2>Latest activity</h2></div>
        <ul v-if="data.recent.length" class="timeline">
          <li v-for="e in data.recent" :key="e.id">
            <time>{{ formatDateTime(e.at) }}</time>
            <NuxtLink :to="`/parcels/${e.parcel.id}`">
              <span class="figure">{{ formatRef(e.parcel.number) }}</span>
              <span class="soft"> {{ eventText(e.type, e.data as any) }}</span>
            </NuxtLink>
          </li>
        </ul>
        <p v-else class="empty">Nothing yet.</p>
      </section>
    </div>
  </div>
</template>
