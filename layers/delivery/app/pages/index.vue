<script setup lang="ts">
useHead({ title: 'Posta' })
const delivery = useDelivery()
const { data } = await useApiData('home', () => delivery.loadHome())
</script>

<template>
  <div v-if="data">
    <div class="tiles">
      <NuxtLink to="/send" class="tile main">
        <AppIcon name="send" />
        <b>Send a parcel</b>
      </NuxtLink>
      <NuxtLink to="/carry" class="tile">
        <AppIcon name="bike" />
        <b>I'm a courier</b>
      </NuxtLink>
    </div>

    <ul class="list" style="margin: -16px 0 24px">
      <li>
        <NuxtLink :to="data.courier?.approved ? '/courier' : '/join'" class="item">
          <span class="item-icon"><AppIcon :name="data.courier?.approved ? 'bike' : 'work'" /></span>
          <span>
            <b>{{ data.courier?.approved ? 'My deliveries' : 'Work with Posta' }}</b>
            <span class="sub">{{
              data.courier?.approved
                ? `${data.courier.openJobs} open ${data.courier.openJobs === 1 ? 'job' : 'jobs'}`
                : data.courier
                  ? 'Application under review'
                  : 'Courier companies and fulfilment centres'
            }}</span>
          </span>
          <AppIcon name="chevron" />
        </NuxtLink>
      </li>
    </ul>

    <section v-if="data.trips.length" style="margin-bottom: 28px">
      <div class="label"><h2>Your trips</h2></div>
      <ul class="list">
        <li v-for="t in data.trips" :key="t.id">
          <NuxtLink :to="`/trips/${t.id}`" class="item">
            <span class="item-icon"><AppIcon name="trips" /></span>
            <span>
              <b>{{ t.fromCity }} → {{ t.toCity }}</b>
              <span class="sub">{{ formatDateTime(t.departAt) }} · {{ t.toCollect ? `${t.toCollect} to collect` : `${t.carrying} of ${t.capacity}` }}</span>
            </span>
            <AppIcon name="chevron" />
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section>
      <div class="label"><h2>Your parcels</h2></div>
      <ul v-if="data.parcels.length" class="list">
        <li v-for="p in data.parcels" :key="p.id">
          <NuxtLink :to="`/parcels/${p.id}`" class="item">
            <span class="item-icon" :class="{ ok: p.status === 'DELIVERED' }"><AppIcon :name="STATUS_ICON[p.status] ?? 'parcel'" /></span>
            <span>
              <b>{{ p.recipientName }}, {{ p.toCity }}</b>
              <span class="sub">{{ PARCEL_STATUS[p.status as ParcelStatusName].label }}</span>
            </span>
            <AppIcon name="chevron" />
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="empty">Nothing sent yet.</p>
    </section>
  </div>
</template>
