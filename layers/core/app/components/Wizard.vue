<script setup lang="ts">
// One question per screen: back arrow, progress bar, logo (home), big heading, content, one big button.
defineProps<{ step: number; total: number; question: string; nextLabel?: string; canNext: boolean; busy?: boolean; error?: string }>()
const emit = defineEmits<{ back: []; next: [] }>()
</script>

<template>
  <div class="wrap wizard">
    <div class="wizard-top">
      <button type="button" class="iconbtn" aria-label="Back" style="margin-left: -12px" @click="emit('back')"><AppIcon name="back" /></button>
      <div class="bar" role="progressbar" :aria-valuenow="step" :aria-valuemax="total"><i :style="{ width: `${(step / total) * 100}%` }" /></div>
      <NuxtLink to="/" class="wordmark" aria-label="Posta home" style="margin-left: 8px">posta<span>.</span></NuxtLink>
    </div>
    <h1 class="q">{{ question }}</h1>
    <form class="wizard-body" novalidate @submit.prevent="canNext && emit('next')">
      <slot />
      <div class="wizard-foot">
        <p v-if="error" class="error-text" role="alert" style="margin-bottom: 12px">{{ error }}</p>
        <button class="btn block" :disabled="!canNext || busy">{{ busy ? 'One moment…' : nextLabel || 'Next' }}</button>
      </div>
    </form>
  </div>
</template>
