<script setup lang="ts">
// "Show this to …": the QR the other person scans, and the same handover as 6 digits to type.
const props = defineProps<{ token: string; code: string; to: string }>()
const url = computed(() => handoverUrl(props.token))
</script>

<template>
  <div class="handover-qr">
    <p class="soft" style="font-weight: 700">Show this to {{ to }}</p>
    <QrCode :value="url" :label="`Handover code for ${to}`" />
    <p class="small faint">or they type</p>
    <p class="big-code" style="font-size: 34px">{{ formatCode(code) }}</p>
  </div>
</template>

<style scoped>
.handover-qr { display: grid; justify-items: center; gap: 10px; text-align: center; }
</style>
