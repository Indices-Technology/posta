<script setup lang="ts">
/**
 * Pick a national postcode on the map: tap (or "Use my location"), drag the pin to adjust, and the
 * postcode of the nearest building comes back from NIPOST. Typing it stays available.
 *
 * Same map as MarketX's MapPinPicker: MapLibre with OpenFreeMap's free street style (no key, no
 * per-view bill), bounded to Nigeria, loaded only on the screens that show a map.
 */
import type { PlaceResult, PostcodeAtPoint } from '../services/postcode.api'

const postcode = defineModel<string>('postcode', { required: true })
const lat = defineModel<number | null>('lat', { default: null })
const lng = defineModel<number | null>('lng', { default: null })
const props = defineProps<{ near?: string }>()

const { atPoint, search } = usePostcodes()
const mapEl = ref<HTMLElement | null>(null)
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

const CONFIDENCE: Record<string, string> = { high: 'This building', medium: 'Close by', low: 'Nearest found', typed: 'Postcode entered' }

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

// ── Search box: places ("Yaba market") and postcodes ("LA 02") ─────────────────────────────
const query = ref('')
const results = ref<PlaceResult[]>([])
const searching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSeq = 0

watch(query, (q) => {
  clearTimeout(searchTimer)
  const text = q.trim()
  if (text.length < 2) return void (results.value = [])
  searchTimer = setTimeout(async () => {
    const seq = ++searchSeq
    searching.value = true
    const near = lat.value != null && lng.value != null ? { lat: lat.value, lng: lng.value } : null
    const found = await search(text, near).catch(() => [] as PlaceResult[])
    if (seq !== searchSeq) return
    searching.value = false
    // A complete postcode typed in full can always be used, even if NIPOST suggests nothing.
    const typed = normalizePostcode(text)
    results.value = typed && !found.some((r) => r.code === typed) ? [{ kind: 'postcode', label: typed, detail: 'Use this postcode', code: typed, complete: true }, ...found] : found
  }, 300)
})

function choose(r: PlaceResult) {
  if (r.kind === 'place' && r.lat != null && r.lng != null) {
    query.value = ''
    results.value = []
    map?.flyTo({ center: [r.lng, r.lat], zoom: 17 })
    pinAt(r.lng, r.lat)
  } else if (r.complete && r.code) {
    // A postcode with no map position (NIPOST keeps those for paid lookups): use it as is.
    query.value = ''
    results.value = []
    postcode.value = r.code
    result.value = { found: true, postcode: r.code, distanceM: 0, confidence: 'typed' as never, address: null, place: null }
  } else if (r.code) {
    query.value = `${r.code} ` // a partial postcode: keep narrowing it down
  }
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
    <div class="search">
      <AppIcon name="search" class="faint" />
      <input
        v-model="query"
        type="search"
        placeholder="Search a place or postcode"
        autocomplete="off"
        aria-label="Search a place or postcode"
        @keydown.enter.prevent="results[0] && choose(results[0])"
      />
    </div>
    <ul v-if="results.length || (searching && query.trim().length > 1)" class="results" role="listbox">
      <li v-if="searching && !results.length" class="soft small" style="padding: 12px">Searching…</li>
      <li v-for="r in results" :key="`${r.kind}:${r.code ?? r.label}:${r.lat}`">
        <button type="button" @click="choose(r)">
          <AppIcon :name="r.kind === 'place' ? 'pin' : 'qr'" class="faint" />
          <span>
            <b :class="{ mono: r.kind === 'postcode' }">{{ r.label }}</b>
            <span v-if="r.detail" class="small soft" style="display: block">{{ r.detail }}</span>
          </span>
        </button>
      </li>
    </ul>

    <div ref="mapEl" class="map" role="application" aria-label="Map: tap the place, drag the pin to adjust" />

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
          <span class="soft">No building within 250 m. Move the pin closer, or search the postcode.</span>
        </template>
        <template v-else-if="error">
          <span class="error-text">{{ error }}</span>
        </template>
        <template v-else>
          <span class="soft">Search, or tap the map where it is.</span>
        </template>
      </div>
  </div>
</template>

<style scoped>
.search { display: flex; align-items: center; gap: 10px; padding: 0 16px; min-height: 56px; border: 1.5px solid var(--line-strong); border-radius: 12px; background: var(--surface); }
.search:focus-within { border-color: var(--ink); }
.search .iconify { font-size: 22px; flex: none; }
.search input { flex: 1; border: 0; outline: none; background: none; color: var(--ink); font: 600 17px var(--font-body); min-width: 0; }
.results { list-style: none; margin: -6px 0 0; padding: 4px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); box-shadow: var(--shadow); max-height: 280px; overflow-y: auto; }
.results button { display: flex; gap: 12px; align-items: flex-start; width: 100%; padding: 10px 12px; border: 0; background: none; border-radius: 8px; text-align: left; cursor: pointer; }
.results button:hover { background: var(--sunken); }
.results .iconify { font-size: 20px; margin-top: 2px; flex: none; }
.map { height: 300px; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); }
.found { min-height: 64px; padding: 12px 16px; border-radius: 12px; border: 1.5px dashed var(--line-strong); display: grid; align-content: center; }
.found.ok { border-style: solid; border-color: var(--ink); background: var(--surface); }
</style>
