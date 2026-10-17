<script setup lang="ts">
// Register a courier company. Optional: their system receives jobs as signed webhooks.
definePageMeta({ layout: false })
useHead({ title: 'Courier company · Posta' })

const delivery = useDelivery()
const courier = useCourier()
const { data } = await useApiData('home', () => delivery.loadHome())
const cities = computed(() => data.value?.cities ?? [])

const f = reactive({ name: '', city: '', phone: data.value?.me.phone ?? '', integrate: null as null | boolean, webhookUrl: '' })
const phoneOk = (p: string) => /^\+?\d[\d\s]{9,15}$/.test(p.trim())
const steps = [
  { q: "Company's name and phone", ok: () => f.name.trim().length > 1 && phoneOk(f.phone), fields: ['name', 'phone'] },
  { q: 'Which city?', ok: () => !!f.city, fields: ['city'] },
  {
    q: 'How should jobs reach you?',
    ok: () => f.integrate === false || (f.integrate === true && f.webhookUrl.startsWith('https://')),
    fields: ['webhookUrl'],
  },
]
const i = ref(0)
const done = ref(false)
const { busy, error, field, run } = useSubmit()

async function next() {
  if (i.value < steps.length - 1) return void i.value++
  const res = await run(() =>
    courier.apply({ kind: 'COMPANY', name: f.name, phone: f.phone, city: f.city, webhookUrl: f.integrate ? f.webhookUrl : undefined }),
  )
  if (res) done.value = true
  else {
    const at = steps.findIndex((s) => s.fields.includes(field.value))
    if (at >= 0) i.value = at
  }
}
const back = () => (i.value ? i.value-- : navigateTo('/join'))
</script>

<template>
  <AppliedScreen v-if="done" what="courier company" />
  <Wizard
    v-else
    :step="i + 1"
    :total="steps.length"
    :question="steps[i]!.q"
    :can-next="steps[i]!.ok()"
    :busy="busy"
    :error="error"
    :next-label="i === steps.length - 1 ? 'Register' : 'Next'"
    @back="back"
    @next="next"
  >
    <template v-if="i === 0">
      <input v-model="f.name" class="big-input" placeholder="Company name" />
      <input v-model="f.phone" class="big-input" placeholder="Phone" type="tel" inputmode="tel" />
    </template>

    <div v-else-if="i === 1" class="chips">
      <button v-for="c in cities" :key="c" type="button" class="chip" :class="{ on: f.city === c }" @click="f.city = c">{{ c }}</button>
    </div>

    <template v-else>
      <div class="chips" style="grid-template-columns: 1fr 1fr">
        <button type="button" class="chip tall" :class="{ on: f.integrate === false }" @click="f.integrate = false">
          <AppIcon name="chat" style="font-size: 32px" />WhatsApp<small>Riders get a link</small>
        </button>
        <button type="button" class="chip tall" :class="{ on: f.integrate === true }" @click="f.integrate = true">
          <AppIcon name="system" style="font-size: 32px" />Our system<small>We send a webhook</small>
        </button>
      </div>
      <input v-if="f.integrate" v-model="f.webhookUrl" class="big-input" placeholder="https://your-system/posta" inputmode="url" autocapitalize="off" />
    </template>
  </Wizard>
</template>
