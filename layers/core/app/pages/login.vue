<script setup lang="ts">
definePageMeta({ public: true, layout: false })
useHead({ title: 'Sign in' })

const route = useRoute()
const { login } = useAuth()
const { busy, error, run } = useSubmit()
const email = ref('')
const password = ref('')

// Only follow local paths, never an outside URL someone put in ?next=
const next = computed(() => {
  const n = String(route.query.next || '/')
  return n.startsWith('/') && !n.startsWith('//') ? n : '/'
})

async function submit() {
  if ((await run(() => login(email.value, password.value))) !== null) await navigateTo(next.value)
}
</script>

<template>
  <div class="auth">
    <aside class="auth-side">
      <p class="wordmark">posta<span>.</span></p>
      <p class="line">Parcels ride on trips <em>already happening.</em></p>
      <p class="small" style="color: #a39b92">Built on the national postcode</p>
    </aside>

    <main class="auth-main">
      <div class="auth-box">
        <p class="wordmark" style="margin-bottom: 40px">posta<span>.</span></p>
        <h1>Sign in</h1>
        <p class="soft" style="margin-top: 6px">Use your MarketX account.</p>

        <form class="stack" style="margin-top: 28px" @submit.prevent="submit">
          <input v-model="email" class="big-input" type="email" autocomplete="email" placeholder="Email" required />
          <input v-model="password" class="big-input" type="password" autocomplete="current-password" placeholder="Password" required />
          <p v-if="error" class="error-text" role="alert">{{ error }}</p>
          <button class="btn block" :disabled="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
        </form>

        <p class="small soft" style="margin-top: 24px">
          No account?
          <a href="https://marketx.africa/user-register" target="_blank" rel="noopener" style="text-decoration: underline">Create one on MarketX</a>
        </p>
      </div>
    </main>
  </div>
</template>
