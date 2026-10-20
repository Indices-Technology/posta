<script setup lang="ts">
// Site-wide titles and link previews. Pages set only `title`; this adds " · Posta" and the rest.
const site = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
const route = useRoute()
const description = 'Send parcels across Nigeria on trips already happening. Drop off at a centre, track every handover, collect or get it at your door.'

useHead({
  titleTemplate: (t) => (t ? `${t} · Posta` : 'Posta · Parcels across Nigeria'),
  link: [{ rel: 'canonical', href: () => site + route.path }],
})
useSeoMeta({
  description,
  ogType: 'website',
  ogSiteName: 'Posta',
  ogTitle: 'Posta · Parcels across Nigeria',
  ogDescription: description,
  ogUrl: () => site + route.path,
  ogImage: `${site}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Posta',
  ogLocale: 'en_NG',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
