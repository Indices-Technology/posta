<script setup lang="ts">
definePageMeta({ public: true, layout: false })
useHead({ title: 'Sign in · Posta' })

const route = useRoute()
const user = useUser()
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

// Only follow local paths, never an outside URL someone put in ?next=
const next = computed(() => {
  const n = String(route.query.next || '/')
  return n.startsWith('/') && !n.startsWith('//') ? n : '/'
})

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const res = await $fetch<{ user: PostaUser }>('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    user.value = res.user
    await navigateTo(next.value)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not sign in. Check your email and password.'
  } finally {
    busy.value = false
  }
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

        <form style="display: grid; gap: 16px; margin-top: 28px" @submit.prevent="submit">
          <label class="field">
            <span>Email</span>
            <input v-model="email" class="input" type="email" autocomplete="email" required />
          </label>
          <label class="field">
            <span>Password</span>
            <input v-model="password" class="input" type="password" autocomplete="current-password" required />
          </label>
          <p v-if="error" class="error-text" role="alert">{{ error }}</p>
          <button class="btn block" :disabled="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
        </form>

        <p class="small soft" style="margin-top: 24px">
          No account?
          <a class="text-link" href="https://marketx.africa/user-register" target="_blank" rel="noopener">Create one on MarketX</a>
        </p>
      </div>
    </main>
  </div>
</template>
