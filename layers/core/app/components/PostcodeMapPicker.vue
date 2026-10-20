<script setup lang="ts">
/**
 * Pick a national postcode on the map: tap (or "Use my location"), drag the pin to adjust, and the
 * postcode of the nearest building comes back from NIPOST. Typing it stays available.
 *
 * Same map as MarketX's MapPinPicker: MapLibre with OpenFreeMap's free street style (no key, no
 * per-view bill), bounded to Nigeria, loaded only on the screens that show a map.
 */
import type { PostcodeAtPoint } from '../services/postcode.api'

const postcode = defineModel<string>('postcode', { required: true })
const lat = defineModel<number | null>('lat', { default: null })
const lng = defineModel<number | null>('lng', { default: null })
const props = defineProps<{ near?: string }>()

const { atPoint } = usePostcodes()
const mapEl = ref<HTMLElement | null>(null)
const typing = ref(false)
const looking = ref(false)
const locating = ref(false)
const error = ref('')
const result = ref<PostcodeAtPoint | null>(null)

let maplibregl: any = null
let map: any = null
let marker: any = null
let lookupSeq = 0

const NIGERIA: [[number, number], [number, number]] = [[2.69, 4.24], [14.68, 13.87]]
const round = (n: number) => Math.round(n * 1e6) / 1e6

const CONFIDENCE: Record<string, string> = { high: 'This building', medium: 'Close by', low: 'Nearest found' }

async function lookup(la: number, ln: number) {
  const seq = ++lookupSeq // only the latest tap wins if they arrive out of order
  looking.value = true
  error.value = ''
  try {
    const r = await atPoint(la, ln)
    if (seq !== lookupSeq) return
    result.value = r
    // The pin decides: no building here means no postcode, never the previous pin's.
    postcode.value = r.found && r.postcode ? r.postcode : ''
  } catch (e) {
    if (seq === lookupSeq) error.value = (e as Error).message
  } finally {
    if (seq === lookupSeq) looking.value = false
  }
}

function pinAt(ln: number, la: number) {
  lat.value = round(la)
  lng.value = round(ln)
  if (!marker) {
    marker = new maplibregl.Marker({ color: '#F43F5E', draggable: true }).setLngLat([ln, la]).addTo(map)
    marker.on('dragend', () => {
      const p = marker.getLngLat()
      pinAt(p.lng, p.lat)
    })
  } else {
    marker.setLngLat([ln, la])
  }
  lookup(lat.value, lng.value)
}

function useMyLocation() {
  if (!navigator.geolocation) return void (error.value = 'This phone cannot share its location. Tap the map instead.')
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17 })
      pinAt(pos.coords.longitude, pos.coords.latitude)
    },
    () => {
      locating.value = false
      error.value = 'Could not get your location. Tap the map instead.'
    },
    { enableHighAccuracy: true, timeout: 15_000 },
  )
}

onMounted(async () => {
  if (!mapEl.value) return
  maplibregl = (await import('maplibre-gl')).default
  await import('maplibre-gl/dist/maplibre-gl.css')

  const has = lat.value != null && lng.value != null
  const start = has ? ([lng.value!, lat.value!] as [number, number]) : cityCentre(props.near)
  map = new maplibregl.Map({
    container: mapEl.value,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: start ?? [8.1, 9.1],
    zoom: has ? 17 : start ? 12 : 5.3,
    maxBounds: NIGERIA,
    attributionControl: false,
  })
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  map.on('click', (e: any) => pinAt(e.lngLat.lng, e.lngLat.lat))
  map.on('load', () => {
    // Map credits stay one tap away (the ⓘ) instead of covering the map on phones.
    mapEl.value?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
    if (has) pinAt(lng.value!, lat.value!)
  })
})

// Choosing a different city moves the map there (unless a pin is already down).
watch(
  () => props.near,
  (city) => {
    const c = cityCentre(city)
    if (map && c && lat.value == null) map.flyTo({ center: c, zoom: 12 })
  },
)

onBeforeUnmount(() => {
  marker?.remove()
  map?.remove()
})
</script>

<template>
  <div class="stack">
    <div v-show="!typing" ref="mapEl" class="map" role="application" aria-label="Map: tap the place, drag the pin to adjust" />

    <template v-if="!typing">
      <button type="button" class="btn quiet block" :disabled="locating" @click="useMyLocation">
        <AppIcon name="gps" />{{ locating ? 'Finding you…' : 'Use my location' }}
      </button>

      <div class="found" :class="{ ok: result?.found && !looking }" aria-live="polite">
        <template v-if="looking">
          <span class="soft">Finding the postcode…</span>
        </template>
        <template v-else-if="result?.found">
          <p class="postcode">{{ result.postcode }}</p>
          <p class="small soft">
            {{ CONFIDENCE[result.confidence ?? ''] ?? 'Found' }}<template v-if="result.distanceM">, {{ result.distanceM }} m from the pin</template>
            <template v-if="result.address || result.place"> · {{ result.address || result.place }}</template>
          </p>
        </template>
        <template v-else-if="result && !result.found">
          <span class="soft">No building within 250 m. Move the pin closer, or type the postcode.</span>
        </template>
        <template v-else-if="error">
          <span class="error-text">{{ error }}</span>
        </template>
        <template v-else>
          <span class="soft">Tap the map where it is.</span>
        </template>
      </div>
    </template>

    <PostcodeInput v-else v-model="postcode" big />

    <button type="button" class="btn small quiet" style="justify-self: start" @click="typing = !typing">
      {{ typing ? 'Use the map instead' : 'Type the postcode instead' }}
    </button>
  </div>
</template>

<style scoped>
.map { height: 300px; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); }
.found { min-height: 64px; padding: 12px 16px; border-radius: 12px; border: 1.5px dashed var(--line-strong); display: grid; align-content: center; }
.found.ok { border-style: solid; border-color: var(--ink); background: var(--surface); }
</style>
