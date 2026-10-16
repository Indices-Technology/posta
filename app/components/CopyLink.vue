<script setup lang="ts">
// Copies a Posta link (job or tracking) as a full URL, ready to paste into WhatsApp.
const props = defineProps<{ path: string; label: string }>()
const copied = ref(false)

async function copy() {
  await navigator.clipboard.writeText(new URL(props.path, window.location.origin).toString())
  copied.value = true
  setTimeout(() => (copied.value = false), 1800)
}
</script>

<template>
  <button type="button" class="btn quiet small" @click="copy">
    <AppIcon :name="copied ? 'check' : 'copy'" />
    {{ copied ? 'Copied' : label }}
  </button>
</template>
