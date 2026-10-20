<script setup lang="ts">
// Real "back" (the page you came from), or `to` when you arrived from outside Posta.
const props = withDefaults(defineProps<{ to?: string }>(), { to: '/' })
const back = useBack()
</script>

<template>
  <button type="button" class="iconbtn" aria-label="Back" @click="back(props.to)"><AppIcon name="back" /></button>
</template>
