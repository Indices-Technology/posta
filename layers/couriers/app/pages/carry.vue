<script setup lang="ts">
// "I'm a courier": two ways to carry parcels with Posta, as two big choices.
useHead({ title: "I'm a courier" })
const delivery = useDelivery()
const { data } = await useApiData('home', () => delivery.loadHome())
const approved = computed(() => !!data.value?.courier?.approved)
</script>

<template>
  <div v-if="data">
    <BackButton style="margin-left: -12px" />
    <h1 style="margin: 8px 0 20px">How do you carry?</h1>

    <div class="stack">
      <NuxtLink to="/travel" class="choice">
        <AppIcon name="travel" />
        <span>
          <b>I'm travelling</b>
          <span class="soft">Going to another city? Take parcels along.</span>
        </span>
        <AppIcon name="chevron" class="faint" />
      </NuxtLink>

      <NuxtLink :to="approved ? '/courier' : '/courier/apply'" class="choice">
        <AppIcon name="bike" />
        <span>
          <b>{{ approved ? 'My deliveries' : 'I deliver in my city' }}</b>
          <span class="soft">{{
            approved
              ? `${data.courier!.openJobs} open ${data.courier!.openJobs === 1 ? 'job' : 'jobs'}`
              : data.courier
                ? 'Application under review'
                : 'On a bike, car or van. Apply once.'
          }}</span>
        </span>
        <AppIcon name="chevron" class="faint" />
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.choice {
  display: grid; grid-template-columns: 48px 1fr auto; align-items: center; gap: 16px;
  min-height: 96px; padding: 18px 20px; border: 1.5px solid var(--line-strong); border-radius: 16px; background: var(--surface);
}
.choice:hover { border-color: var(--ink); }
.choice > .iconify:first-child { font-size: 40px; }
.choice b { display: block; font: 750 19px var(--font-display); margin-bottom: 2px; }
.choice .soft { font-size: 15px; }
</style>
