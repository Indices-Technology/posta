<script setup lang="ts">
/**
 * The parcel's trip on a map. On open, the parcel replays the stretch it has already made; if it
 * is on the road, it keeps gliding along the current stretch over a moving dashed line. Posta has
 * no live GPS, so the caption names the stretch ("Between Jos and Yaba Partner Shop") and never a
 * position. Reduced-motion users get the final picture without animation.
 */
import type { Journey } from '~~/layers/delivery/server/utils/journey'

const props = defineProps<{ journey: Journey }>()
const el = ref<HTMLElement | null>(null)

type Pt = [number, number]
const pts = computed<Pt[]>(() => props.journey.stops.map((s) => [s.lng, s.lat]))
const last = computed(() => props.journey.stops.length - 1)

const caption = computed(() => {
  const j = props.journey
  const here = j.stops[j.at]!.label
  if (j.moving) return j.between
  if (j.at === last.value) return `Delivered in ${here}`
  if (j.at === 0) return `In ${here}, waiting for a traveller`
  return `At ${here}`
})

let maplibregl: any
let map: any
let parcel: any
let raf = 0
let dashTimer: ReturnType<typeof setInterval> | undefined

const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const line = (coordinates: Pt[]) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })

/** Point a fraction `t` of the way along a path, plus the path drawn so far. */
function along(path: Pt[], t: number): { at: Pt; drawn: Pt[] } {
  if (path.length < 2) return { at: path[0]!, drawn: path }
  const lens = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i]![0], p[1] - path[i]![1]))
  let left = t * lens.reduce((a, b) => a + b, 0)
  for (let i = 0; i < lens.length; i++) {
    if (left <= lens[i]! || i === lens.length - 1) {
      const p = lerp(path[i]!, path[i + 1]!, lens[i] ? Math.min(1, left / lens[i]!) : 1)
      return { at: p, drawn: [...path.slice(0, i + 1), p] }
    }
    left -= lens[i]!
  }
  return { at: path[path.length - 1]!, drawn: path }
}

function el$(className: string, html = '') {
  const d = document.createElement('div')
  d.className = className
  d.innerHTML = html
  return d
}

// A small box, drawn inline so it needs no icon font inside the map.
const BOX = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg>'

onMounted(async () => {
  if (!el.value) return
  maplibregl = (await import('maplibre-gl')).default
  await import('maplibre-gl/dist/maplibre-gl.css')

  const css = getComputedStyle(document.documentElement)
  const ink = css.getPropertyValue('--ink').trim() || '#1a1614'
  const faint = css.getPropertyValue('--ink-faint').trim() || '#8f877f'
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const { at, moving } = props.journey

  const bounds = pts.value.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(pts.value[0], pts.value[0]))
  map = new maplibregl.Map({
    container: el.value,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    bounds,
    fitBoundsOptions: { padding: { top: 40, right: 48, bottom: 64, left: 48 }, maxZoom: 14 },
    attributionControl: false,
    cooperativeGestures: true, // a page that scrolls must not get trapped by the map
  })
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

  map.on('load', () => {
    el.value?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')

    const done = pts.value.slice(0, at + 1)
    const ahead = pts.value.slice(moving ? at + 1 : at)
    map.addSource('ahead', { type: 'geojson', data: line(ahead.length > 1 ? ahead : [pts.value[at]!, pts.value[at]!]) })
    map.addLayer({ id: 'ahead', type: 'line', source: 'ahead', paint: { 'line-color': faint, 'line-width': 3, 'line-dasharray': [1, 2] } })
    map.addSource('moving', { type: 'geojson', data: line(moving ? [pts.value[at]!, pts.value[at + 1]!] : [pts.value[at]!, pts.value[at]!]) })
    map.addLayer({ id: 'moving', type: 'line', source: 'moving', paint: { 'line-color': ink, 'line-width': 3, 'line-dasharray': [0, 4, 3] } })
    map.addSource('done', { type: 'geojson', data: line(reduced ? done : [done[0]!, done[0]!]) })
    map.addLayer({ id: 'done', type: 'line', source: 'done', layout: { 'line-cap': 'round' }, paint: { 'line-color': ink, 'line-width': 4 } })

    const labels = props.journey.stops.map((s, i) => {
      const node = el$(`stop ${i <= at ? 'reached' : ''}`, `<i></i><span>${s.label.replace(/[<>&]/g, '')}</span>`)
      new maplibregl.Marker({ element: node, anchor: 'top' }).setLngLat([s.lng, s.lat]).addTo(map)
      return { i, node, lngLat: [s.lng, s.lat] as Pt }
    })
    // Stops close together (a centre and the door in the same city) would print their labels on top
    // of each other. Keep the most useful one: where the parcel is now, then the start, then the end.
    const priority = (i: number) => (i === at ? 0 : i === 0 ? 1 : i === last.value ? 2 : 3)
    const declutter = () => {
      const shown: { x: number; y: number }[] = []
      for (const l of [...labels].sort((a, b) => priority(a.i) - priority(b.i))) {
        const { x, y } = map.project(l.lngLat)
        const clash = shown.some((p) => Math.abs(p.x - x) < 90 && Math.abs(p.y - y) < 26)
        l.node.classList.toggle('quiet', clash)
        if (!clash) shown.push({ x, y })
      }
    }
    declutter()
    map.on('moveend', declutter)

    parcel = new maplibregl.Marker({ element: el$(`parcel ${moving ? '' : 'resting'}`, BOX) }).setLngLat(pts.value[0]!).addTo(map)

    if (reduced) {
      parcel.setLngLat(pts.value[at]!)
      return
    }

    // 1. Replay what it has already travelled.
    const replayMs = Math.min(2400, 900 * Math.max(1, done.length - 1))
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / replayMs)
      const { at: p, drawn } = along(done, ease(t))
      parcel.setLngLat(p)
      map.getSource('done')?.setData(line(drawn.length > 1 ? drawn : [drawn[0]!, drawn[0]!]))
      if (t < 1) raf = requestAnimationFrame(step)
      else if (moving) glide()
    }
    raf = requestAnimationFrame(step)
  })

  // 2. On the road: glide along the current stretch, over a dashed line that keeps moving.
  function glide() {
    const a = pts.value[at]!
    const b = pts.value[at + 1]!
    const period = 6000
    const t0 = performance.now()
    const loop = (now: number) => {
      parcel.setLngLat(lerp(a, b, ease(((now - t0) % period) / period)))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const seq = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]]
    let k = 0
    dashTimer = setInterval(() => map?.setPaintProperty('moving', 'line-dasharray', seq[(k = (k + 1) % seq.length)]), 70)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearInterval(dashTimer)
  map?.remove()
})
</script>

<template>
  <figure class="journey-map">
    <div ref="el" class="canvas" role="img" :aria-label="`Map of the parcel's route. ${caption}`" />
    <figcaption class="row">
      <span class="status" :class="journey.moving ? 'tone-ink' : journey.at === journey.stops.length - 1 ? 'tone-ok' : 'tone-neutral'">
        <i class="dot" />{{ caption }}
      </span>
    </figcaption>
  </figure>
</template>

<style scoped>
.journey-map { margin: 18px 0 0; }
.canvas { height: 240px; border-radius: 16px; overflow: hidden; border: 1px solid var(--line); }
figcaption { margin-top: 10px; }

/* Map markers are plain DOM inside MapLibre, so they need :deep(). Round is allowed: these are dots. */
.canvas :deep(.stop) { display: grid; justify-items: center; gap: 4px; pointer-events: none; }
.canvas :deep(.stop i) { width: 12px; height: 12px; border-radius: 50%; background: var(--surface); border: 2.5px solid var(--ink-faint); }
.canvas :deep(.stop.reached i) { background: var(--ink); border-color: var(--ink); }
.canvas :deep(.stop span) {
  font: 700 11px var(--font-body); color: var(--ink); background: color-mix(in srgb, var(--surface) 88%, transparent);
  padding: 1px 6px; border-radius: 4px; white-space: nowrap;
}
.canvas :deep(.stop.quiet span) { display: none; }
.canvas :deep(.parcel) {
  width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
  background: var(--ink); color: var(--bg); box-shadow: 0 4px 14px rgba(26, 22, 20, 0.28);
}
.canvas :deep(.parcel.resting) { animation: rest 2.4s ease-in-out infinite; }
@keyframes rest {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ink) 35%, transparent); }
  50% { box-shadow: 0 0 0 10px transparent; }
}
@media (prefers-reduced-motion: reduce) { .canvas :deep(.parcel.resting) { animation: none; } }
</style>
