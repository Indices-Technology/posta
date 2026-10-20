<script setup lang="ts">
// The centre dashboard: scan what arrives, and hand on what's on the shelf. Only this centre's part.
import type { IconName } from '~~/layers/core/app/components/AppIcon.vue'

useHead({ title: 'Centre' })
const hubs = useHubs()
const { data, refresh } = await useApiData('centre', () => hubs.dashboard())
const open = ref<string | null>(null) // the shelf row whose QR is showing

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(refresh, 15_000)))
onBeforeUnmount(() => clearInterval(timer))

const WHO_ICON: Record<string, IconName> = { SENDER: 'user', COURIER: 'bike', TRAVELLER: 'trips', RECIPIENT: 'home', CENTRE: 'hubs' }
const STATUS: Record<string, string> = { PENDING: 'Under review', REJECTED: 'Not approved', SUSPENDED: 'Paused' }
</script>

<template>
  <div v-if="data">
    <section v-if="!data.centres.length" class="panel" style="text-align: center">
      <div class="hero-icon" style="margin-inline: auto"><AppIcon name="hubs" /></div>
      <h2>You don't run a centre yet</h2>
      <NuxtLink to="/hubs/join" class="btn block" style="margin-top: 20px">Register your shop</NuxtLink>
    </section>

    <div v-for="c in data.centres" :key="c.hub.id" style="margin-bottom: 32px">
      <h1>{{ c.hub.name }}</h1>
      <p class="soft" style="margin-top: 4px">{{ c.hub.city }}</p>

      <section v-if="c.hub.status !== 'APPROVED'" class="panel" style="margin-top: 18px">
        <span class="status tone-neutral"><i class="dot" />{{ STATUS[c.hub.status] }}</span>
        <p class="soft" style="margin-top: 8px">Parcels start coming once Posta approves the centre.</p>
      </section>

      <template v-else>
        <NuxtLink to="/scan" class="btn block" style="margin-top: 18px"><AppIcon name="scan" />Scan</NuxtLink>

        <section style="margin-top: 24px">
          <div class="label"><h2>Coming in</h2><span class="small faint">{{ c.incoming.length }}</span></div>
          <ul v-if="c.incoming.length" class="list">
            <li v-for="r in c.incoming" :key="r.id" class="item">
              <span class="item-icon"><AppIcon :name="WHO_ICON[r.who.party] ?? 'parcel'" /></span>
              <span>
                <b>{{ r.ref }} · {{ r.contents }}</b>
                <span class="sub">From {{ r.who.name }}{{ r.status === 'READY' ? ' · scan when it arrives' : ' · on the way' }}</span>
              </span>
              <AppIcon :name="r.status === 'READY' ? 'incoming' : 'timer'" />
            </li>
          </ul>
          <p v-else class="empty">Nothing on the way.</p>
        </section>

        <section style="margin-top: 16px">
          <div class="label"><h2>On your shelf</h2><span class="small faint">{{ c.shelf.length }}</span></div>
          <ul v-if="c.shelf.length" class="list">
            <li v-for="r in c.shelf" :key="r.id">
              <button type="button" class="item shelf" :disabled="!r.qr && r.action !== 'scan'" @click="open = open === r.id ? null : r.id">
                <span class="item-icon"><AppIcon :name="WHO_ICON[r.who.party] ?? 'parcel'" /></span>
                <span>
                  <b>{{ r.ref }} · {{ r.contents }}</b>
                  <span class="sub">
                    <template v-if="r.status !== 'READY'">Waiting for a {{ r.who.party === 'TRAVELLER' ? 'traveller' : 'courier' }}</template>
                    <template v-else-if="r.action === 'scan'">{{ r.who.name }} collects · scan their code</template>
                    <template v-else>Give to {{ r.who.name }}{{ r.when ? ` · leaves ${formatDateTime(r.when)}` : '' }}</template>
                  </span>
                </span>
                <AppIcon :name="r.qr ? 'qr' : r.action === 'scan' && r.status === 'READY' ? 'scan' : 'timer'" />
              </button>
              <div v-if="open === r.id && r.qr" style="padding: 8px 0 20px">
                <HandoverQr :token="r.qr.token" :code="r.qr.code" :to="r.who.name ?? 'them'" />
              </div>
            </li>
          </ul>
          <p v-else class="empty">Shelf is empty.</p>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.shelf { width: 100%; border: 0; background: none; text-align: left; cursor: pointer; }
.shelf:disabled { cursor: default; }
</style>
