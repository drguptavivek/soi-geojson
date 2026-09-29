import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import { leafletUrl } from '../config/basemaps'
import { colorFor, fillFor } from '../config/palette'
import 'leaflet/dist/leaflet.css'

const INDIA = [22.5, 79.0]

/** Single-colour styling, used for the national context layers. */
const FILL = {
  states: { color: '#2563eb', weight: 1, fillOpacity: 0.15 },
  districts: { color: '#0d9488', weight: 0.8, fillOpacity: 0.2 },
  subdistricts: { color: '#b45309', weight: 0.5, fillOpacity: 0.3 },
  disputed: { color: '#dc2626', weight: 1, dashArray: '4 3', fillOpacity: 0.15 },
}

/** Every [lng, lat] pair in a geometry, however deeply it is nested. */
function coordPairs(geometry) {
  const out = []
  const walk = (c) => (typeof c[0] === 'number' ? out.push(c) : c.forEach(walk))
  walk(geometry.coordinates)
  return out
}

/**
 * Presentation signature. react-leaflet does not re-run onEachFeature when only
 * styling or label options change, so the key has to change to force the
 * layers to be rebuilt and tooltips rebound.
 */
const sigOf = (l) => JSON.stringify([l.categorical, l.style, l.labels, l.emphasis])

/**
 * Leaflet wants a function so each feature can take its own colour. Three
 * modes: `categorical` gives every polygon its own hue, `emphasis` singles one
 * feature out and mutes the rest, otherwise the layer is flat.
 */
function styleFor(layer, features) {
  if (layer.categorical) {
    const { weight = 1.1, fillOpacity = 0.3, focus } = layer
    return (feature) => {
      const i = features.indexOf(feature)
      const on = !focus?.matches || focus.matches(feature)
      return {
        color: colorFor(i),
        // Siblings keep a readable outline even when dimmed -- the boundary
        // between them is the thing being compared.
        weight: on ? weight * 1.6 : weight * 0.9,
        fillColor: fillFor(i, on ? fillOpacity : fillOpacity * 0.55),
        fillOpacity: on ? 1 : 0.7,
      }
    }
  }
  const base = { ...FILL[layer.kind], ...layer.style }
  if (layer.emphasis) {
    const { key, value, color, weight, fillOpacity = 0.12 } = layer.emphasis
    return (feature) => (feature.properties?.[key] === value
      ? { ...base, color, weight, fillOpacity }
      : base)
  }
  return base
}

/** Fit the viewport to the detail the user drilled into. */
function FitBounds({ geojson, focus }) {
  const map = useMap()
  useEffect(() => {
    if (!geojson?.features?.length) return
    // When one polygon is focused, frame the whole group so its siblings stay
    // visible: zooming to the single polygon hides the very boundaries the
    // user is comparing it against.
    const pts = geojson.features.flatMap((f) => coordPairs(f.geometry))
    if (!pts.length) return
    const lats = pts.map((p) => p[1])
    const lngs = pts.map((p) => p[0])
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [24, 24], maxZoom: 13 },
    )
  }, [geojson, focus, map])
  return null
}

export default function MapView({ layers, legend, basemap }) {
  // Layers are ordered general -> specific, so the last one loaded is the
  // detail the user drilled into; that is what the viewport should frame.
  const primary = layers.filter((l) => l.data).at(-1)

  const styled = useMemo(
    () => layers.map((l) => {
      if (!l.data) return l
      const nameKey = l.nameKey || (l.kind === 'states' ? 'state_name' : `${l.kind}_name`)
      return {
        ...l,
        styled: styleFor(l, l.data.features),
        onEach: (feature, lyr) => {
          const name = feature.properties?.[nameKey]
          // Leaflet holds one tooltip per layer, so a permanent label and a
          // hover tip are mutually exclusive -- never bind both.
          if (name && l.labels) {
            lyr.bindTooltip(name, { permanent: true, direction: 'center', className: 'omp-label' })
          } else if (name) {
            lyr.bindTooltip(name, { sticky: true, className: 'omp-tip' })
          }
          if (l.onClick && name) {
            lyr.on('click', () => l.onClick(feature.properties))
            if (!l.categorical) {
              lyr.on('mouseover', () => lyr.setStyle({ weight: 2.2 }))
              lyr.on('mouseout', () => lyr.setStyle({
                weight: FILL[l.kind].weight, color: l.style?.color ?? FILL[l.kind].color,
              }))
            }
          }
        },
      }
    }),
    [layers],
  )

  return (
    <MapContainer
      center={INDIA}
      zoom={4.5}
      minZoom={3}
      maxZoom={basemap?.maxZoom ?? 14}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      {basemap && (
        <TileLayer
          key={basemap.id}
          url={leafletUrl(basemap, true)}
          maxZoom={basemap.maxZoom ?? 19}
        />
      )}
      {styled.map((l) => (l.data
        ? <GeoJSON key={`${l.key}:${sigOf(l)}`} data={l.data} style={l.styled} onEachFeature={l.onEach} />
        : null))}
      <FitBounds geojson={primary?.data} focus={primary?.focus} />
      {legend.length > 0 && (
        <div className="legend">
          {legend.map((l) => (
            <div className="legend-item" key={l.label}>
              <span className="swatch" style={{ background: l.color }} />
              {l.label}
              {l.count != null && <span className="count">{l.count}</span>}
            </div>
          ))}
        </div>
      )}
    </MapContainer>
  )
}
