<script setup lang="ts">
import type { NuxtError } from '#app'
const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)
</script>

<template>
  <main class="wrap">
    <header class="top"><span class="wordmark">posta<span>.</span></span></header>
    <div class="page" style="text-align: center; padding-top: 48px">
      <div class="hero-icon" style="margin-inline: auto"><AppIcon :name="notFound ? 'pin' : 'alert'" /></div>
      <h1>{{ notFound ? 'Not found' : 'Something went wrong' }}</h1>
      <p class="soft" style="margin-top: 8px">{{ notFound ? error.statusMessage || 'This page does not exist.' : 'Try again in a moment.' }}</p>
      <button class="btn ink" style="margin-top: 28px" @click="clearError({ redirect: '/' })">Go home</button>
    </div>
  </main>
</template>
