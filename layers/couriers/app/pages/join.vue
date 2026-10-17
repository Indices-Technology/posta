<script setup lang="ts">
useHead({ title: 'Work with Posta' })
</script>

<template>
  <div>
    <NuxtLink to="/" class="iconbtn" aria-label="Home" style="margin-left: -12px"><AppIcon name="back" /></NuxtLink>
    <h1 style="margin: 8px 0 20px">Work with Posta</h1>

    <ul class="list">
      <li>
        <NuxtLink to="/courier/apply" class="item">
          <span class="item-icon"><AppIcon name="bike" /></span>
          <span><b>Deliver parcels</b><span class="sub">Earn on your bike, car or van</span></span>
          <AppIcon name="chevron" />
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/courier/company" class="item">
          <span class="item-icon"><AppIcon name="company" /></span>
          <span><b>Courier company</b><span class="sub">Your riders take Posta jobs</span></span>
          <AppIcon name="chevron" />
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/hubs/join" class="item">
          <span class="item-icon"><AppIcon name="hubs" /></span>
          <span><b>Fulfilment centre</b><span class="sub">Your shop receives and hands on parcels</span></span>
          <AppIcon name="chevron" />
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/courier" class="item">
          <span class="item-icon"><AppIcon name="check" /></span>
          <span><b>My applications</b><span class="sub">Status and jobs</span></span>
          <AppIcon name="chevron" />
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
