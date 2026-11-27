import { useEffect, useRef } from 'react'
import { googleMapId } from '../lib/googleMaps'

export default function GoogleMap({ sdk, campus, points, value, onOpen, onPick, height, zoom }) {
  const box = useRef(null)
  const map = useRef(null)
  const picker = useRef(null)
  const latest = useRef(null)
  latest.current = { points, value, onOpen, onPick }
  const clickable = Boolean(onOpen)
  const picking = Boolean(onPick)
  const lat = value?.lat
  const lng = value?.lng

  useEffect(() => {
    const { points: initialPoints, value: initialValue } = latest.current
    const center = initialValue ?? initialPoints[0] ?? campus
    const element = box.current
    const instance = new sdk.Map(element, {
      center: { lat: center.lat, lng: center.lng },
      zoom,
      mapId: googleMapId,
      gestureHandling: 'cooperative',
      mapTypeControl: false,
      streetViewControl: false,
      clickableIcons: false,
    })
    const click = instance.addListener('click', event => {
      if (event.latLng) latest.current.onPick?.(event.latLng.toJSON())
    })
    map.current = instance
    return () => {
      click.remove()
      map.current = null
      element.replaceChildren()
    }
  }, [sdk, campus, zoom])

  useEffect(() => {
    const instance = map.current
    const markers = points.map(point => {
      const marker = new sdk.AdvancedMarkerElement({
        map: instance,
        position: { lat: point.lat, lng: point.lng },
        title: point.label,
        gmpClickable: clickable,
      })
      marker.addEventListener('gmp-click', () => latest.current.onOpen?.(point.id))
      return marker
    })
    if (points.length > 1 && !picking) {
      const bounds = new sdk.LatLngBounds()
      points.forEach(({ lat, lng }) => bounds.extend({ lat, lng }))
      instance.fitBounds(bounds, 42)
    }
    return () => markers.forEach(marker => { marker.map = null })
  }, [sdk, campus, zoom, points, clickable, picking])

  useEffect(() => {
    if (!picking) return
    const marker = new sdk.AdvancedMarkerElement({
      title: 'Selected canteen location',
      gmpDraggable: true,
    })
    const drag = marker.addListener('dragend', event => {
      if (event.latLng) latest.current.onPick?.(event.latLng.toJSON())
    })
    picker.current = marker
    return () => {
      picker.current = null
      drag.remove()
      marker.map = null
    }
  }, [sdk, campus, zoom, picking])

  useEffect(() => {
    if (!picker.current) return
    const position = lat == null || lng == null ? null : { lat, lng }
    if (!position) { picker.current.map = null; return }
    picker.current.position = position
    picker.current.map = map.current
    if (!map.current.getBounds()?.contains(position)) map.current.panTo(position)
  }, [sdk, campus, zoom, picking, lat, lng])

  return <div className="map" role="region" aria-label="Google Maps" ref={box} style={{ height }} />
}
