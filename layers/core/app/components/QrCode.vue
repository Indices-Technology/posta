<script setup lang="ts">
// A QR code, drawn as SVG. Always dark on white (even in dark mode) so phone cameras read it.
import QRCode from 'qrcode'

const props = defineProps<{ value: string; size?: number; label?: string }>()
const svg = ref('')

watchEffect(async () => {
  svg.value = await QRCode.toString(props.value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1a1614', light: '#ffffff' } })
})
</script>

<template>
  <div class="qr" :style="{ width: `${size ?? 220}px` }" role="img" :aria-label="label ?? 'QR code'" v-html="svg" />
</template>

<style scoped>
.qr { aspect-ratio: 1; padding: 10px; background: #fff; border-radius: 12px; border: 1px solid var(--line); }
.qr :deep(svg) { display: block; width: 100%; height: 100%; }
</style>
