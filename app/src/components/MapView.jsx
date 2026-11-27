import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import GoogleMap from './GoogleMap'
import { hasGoogleMaps, loadGoogleMaps, onGoogleAuthFailure } from '../lib/googleMaps'
import { canteenMapLink } from '../lib/share'

/** University of Moratuwa, Katubedda. */
export const CAMPUS = [6.7958, 79.9008]
const GOOGLE_CAMPUS = { lat: CAMPUS[0], lng: CAMPUS[1] }
const EMPTY_POINTS = []

export default function MapView({ points = EMPTY_POINTS, onOpen, value, onPick, height = 340, zoom = 17 }) {
  const [sdk, setSdk] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!hasGoogleMaps) return
    let live = true
    const unsubscribe = onGoogleAuthFailure(() => setFailed(true))
    loadGoogleMaps().then(loaded => { if (live) setSdk(loaded) }, () => { if (live) setFailed(true) })
    return () => { live = false; unsubscribe() }
  }, [])

  const props = { points, onOpen, value, onPick, height, zoom }
  const location = points.length === 1 ? points[0] : GOOGLE_CAMPUS

  return (
    <>
      {hasGoogleMaps && !failed ? (sdk
        ? <GoogleMap sdk={sdk} campus={GOOGLE_CAMPUS} {...props} />
        : <div className="map map-loading" style={{ height }} role="status">Loading Google Maps…</div>)
        : <LeafletMap {...props} />}
      {!onPick && <a className="map-google-link mini" href={canteenMapLink(location)} target="_blank" rel="noreferrer">Open in Google Maps</a>}
    </>
  )
}

// The logo plate as the pin, so we don't depend on Leaflet's default marker images.
const pin = (big = false) => L.divIcon({
  className: 'mpin' + (big ? ' big' : ''),
  html: '<svg viewBox="0 0 200 200" aria-hidden="true"><use href="#mark"/></svg>',
  iconSize: big ? [44, 44] : [34, 34],
  iconAnchor: big ? [22, 22] : [17, 17],
})

/**
 * OpenStreetMap via Leaflet.
 *  - points + onOpen: show canteen pins; tapping one calls onOpen(id).
 *  - value + onPick: picker mode; tap the map (or drag the pin) to choose a spot.
 */
function LeafletMap({ points, onOpen, value, onPick, height, zoom }) {
  const box = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const picker = useRef(null)
  const cb = useRef({ onOpen, onPick })
  cb.current = { onOpen, onPick }

  useEffect(() => {
    const start = value ? [value.lat, value.lng] : points.length ? [points[0].lat, points[0].lng] : CAMPUS
    const m = L.map(box.current, { scrollWheelZoom: false, zoomControl: true }).setView(start, zoom)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    m.on('click', e => cb.current.onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }))
    map.current = m
    return () => { m.remove(); map.current = null; picker.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Canteen pins
  useEffect(() => {
    const g = layer.current
    if (!g) return
    g.clearLayers()
    points.forEach(p => {
      const tooltip=document.createElement('span'); tooltip.textContent=p.label
      L.marker([p.lat, p.lng], { icon: pin(), title: p.label, keyboard: true })
        .bindTooltip(tooltip, { direction: 'top', offset: [0, -16] })
        .on('click', () => cb.current.onOpen?.(p.id))
        .addTo(g)
    })
    if (points.length > 1 && !value) map.current.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 18 })
  }, [points, value])

  // Picker pin
  useEffect(() => {
    const m = map.current
    if (!m || !onPick) return
    if (!value) { picker.current?.remove(); picker.current = null; return }
    if (!picker.current) {
      picker.current = L.marker([value.lat, value.lng], { icon: pin(true), draggable: true })
        .on('dragend', e => { const ll = e.target.getLatLng(); cb.current.onPick?.({ lat: ll.lat, lng: ll.lng }) })
        .addTo(m)
    } else {
      picker.current.setLatLng([value.lat, value.lng])
    }
    if(!m.getBounds().contains([value.lat,value.lng]))m.panTo([value.lat,value.lng])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng])

  return <div className="map" ref={box} style={{ height }} />
}

/** Re-centre helper for "Use my location". */
export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser can't share your location."))
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error("Couldn't get your location. Tap the map instead.")),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}
