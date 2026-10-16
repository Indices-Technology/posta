<script setup lang="ts">
useHead({ title: 'Book a parcel · Posta' })
const { data: hubData } = await useFetch('/api/hubs')
// Only cities with a handover point can receive parcels.
const cities = computed(() => [...new Set(hubData.value?.hubs.map((h) => h.city) ?? [])])

const f = reactive({
  senderName: '',
  senderPhone: '',
  pickupPostcode: '',
  fromCity: '',
  recipientName: '',
  recipientPhone: '',
  dropPostcode: '',
  toCity: '',
  description: '',
  weightKg: '',
  valueNaira: '',
})
const { busy, error, field, submit } = useForm<{ id: string }>('/api/parcels')

async function book() {
  const res = await submit({ ...f })
  if (res) await navigateTo(`/parcels/${res.id}`)
}
const bad = (name: string) => field.value === name
</script>

<template>
  <div>
    <NuxtLink to="/parcels" class="back"><AppIcon name="back" />Parcels</NuxtLink>
    <div class="page-head">
      <div>
        <h1>Book a parcel</h1>
        <p class="sub">It rides on the first trip going the same way.</p>
      </div>
    </div>

    <form novalidate @submit.prevent="book">
      <section class="form-section">
        <div class="about">
          <h2>Sender</h2>
          <p>The driver collects from here and gets a code from this person.</p>
        </div>
        <div class="fields">
          <label class="field"><span>Name</span><input v-model="f.senderName" class="input" :class="{ bad: bad('senderName') }" autocomplete="name" /></label>
          <label class="field"><span>Phone</span><input v-model="f.senderPhone" class="input" :class="{ bad: bad('senderPhone') }" type="tel" inputmode="tel" placeholder="0803 000 0000" /></label>
          <label class="field">
            <span>Pickup postcode</span>
            <PostcodeInput v-model="f.pickupPostcode" :bad="bad('pickupPostcode')" />
          </label>
          <label class="field">
            <span>City</span>
            <input v-model="f.fromCity" class="input" :class="{ bad: bad('fromCity') }" list="known-cities" placeholder="Jos" />
          </label>
        </div>
      </section>

      <section class="form-section">
        <div class="about">
          <h2>Recipient</h2>
          <p>A courier delivers the last stretch. The recipient gets a tracking link with their delivery code.</p>
        </div>
        <div class="fields">
          <label class="field"><span>Name</span><input v-model="f.recipientName" class="input" :class="{ bad: bad('recipientName') }" /></label>
          <label class="field"><span>Phone</span><input v-model="f.recipientPhone" class="input" :class="{ bad: bad('recipientPhone') }" type="tel" inputmode="tel" placeholder="0803 000 0000" /></label>
          <label class="field">
            <span>Delivery postcode</span>
            <PostcodeInput v-model="f.dropPostcode" :bad="bad('dropPostcode')" />
          </label>
          <label class="field">
            <span>City</span>
            <select v-model="f.toCity" class="input" :class="{ bad: bad('toCity') }">
              <option value="" disabled>Choose</option>
              <option v-for="c in cities" :key="c" :value="c">{{ c }}</option>
            </select>
            <span class="hint">Cities with a Posta handover point</span>
          </label>
        </div>
      </section>

      <section class="form-section">
        <div class="about">
          <h2>Parcel</h2>
          <p>The driver sees what they are carrying.</p>
        </div>
        <div class="fields">
          <label class="field wide">
            <span>Contents</span>
            <input v-model="f.description" class="input" :class="{ bad: bad('description') }" placeholder="2 pairs of shoes" maxlength="140" />
          </label>
          <label class="field">
            <span>Weight</span>
            <div class="input-wrap"><input v-model="f.weightKg" class="input" :class="{ bad: bad('weightKg') }" style="padding-left: 12px" inputmode="decimal" placeholder="1.5" /></div>
            <span class="hint">In kg, up to 30</span>
          </label>
          <label class="field">
            <span>Declared value</span>
            <div class="input-wrap"><span class="prefix">₦</span><input v-model="f.valueNaira" class="input" :class="{ bad: bad('valueNaira') }" inputmode="numeric" placeholder="25000" /></div>
            <span class="hint">Up to ₦500,000</span>
          </label>
        </div>
      </section>

      <div class="form-actions">
        <p v-if="error" class="form-error" role="alert"><AppIcon name="alert" />{{ error }}</p>
        <NuxtLink to="/parcels" class="btn quiet">Cancel</NuxtLink>
        <button class="btn" :disabled="busy">{{ busy ? 'Booking…' : 'Book parcel' }}</button>
      </div>
    </form>

    <datalist id="known-cities">
      <option v-for="c in cities" :key="c" :value="c" />
    </datalist>
  </div>
</template>
