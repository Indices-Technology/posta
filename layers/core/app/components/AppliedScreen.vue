<script setup lang="ts">
// "Thanks, we'll review it" after any partner application.
defineProps<{ what: string }>()
</script>

<template>
  <div class="wrap" style="text-align: center; padding-top: 96px">
    <div class="hero-icon ok" style="margin-inline: auto"><AppIcon name="done" /></div>
    <h1>Application sent</h1>
    <p class="soft" style="margin-top: 8px">We review every {{ what }} and let you know in Messages.</p>
    <NuxtLink to="/" class="btn ink block" style="margin-top: 32px">Done</NuxtLink>
  </div>
</template>
