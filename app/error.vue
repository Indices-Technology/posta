<script setup lang="ts">
import type { NuxtError } from '#app'
const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)
</script>

<template>
  <main class="public" style="padding-top: 72px">
    <p class="wordmark">posta<span>.</span></p>
    <h1 style="margin-top: 32px">{{ notFound ? 'Not found' : 'Something went wrong' }}</h1>
    <p class="soft" style="margin-top: 8px">{{ notFound ? error.statusMessage || 'This page does not exist.' : 'Try again in a moment.' }}</p>
    <button class="btn ink" style="margin-top: 24px" @click="clearError({ redirect: '/' })">Go to Posta</button>
  </main>
</template>
