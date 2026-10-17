<script setup lang="ts">
// Accepts the postcode however it's typed (spaces, dashes, lower case) and tidies it to FC-01-A01-KP-27 on blur.
const model = defineModel<string>({ required: true })
defineProps<{ bad?: boolean; big?: boolean }>()

function tidy() {
  model.value = normalizePostcode(model.value) ?? model.value.toUpperCase().trim()
}
</script>

<template>
  <input
    v-model="model"
    :class="[big ? 'big-input' : 'input', 'mono', { bad }]"
    placeholder="FC-01-A01-KP-27"
    autocapitalize="characters"
    autocomplete="off"
    spellcheck="false"
    maxlength="20"
    @blur="tidy"
  />
</template>
