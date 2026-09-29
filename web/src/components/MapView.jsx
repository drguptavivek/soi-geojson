import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const INDIA = [22.5, 79.0]

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

function FitBounds({ geojson }) {
  const map = useMap()
  useEffect(() => {
    if (!geojson?.features?.length) return
    const pts = geojson.features.flatMap((f) => coordPairs(f.geometry))
    if (!pts.length) return
    const lats = pts.map((p) => p[1])
    const lngs = pts.map((p) => p[0])
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [24, 24] },
    )
  }, [geojson, map])
  return null
}

export default function MapView({ layers, legend }) {
  // Layers are ordered general -> specific, so the last one loaded is the
  // detail the user drilled into; that is what the viewport should frame.
  const primary = layers.filter((l) => l.data).at(-1)?.data

  const styled = useMemo(
    () => layers.map((l) => (l.data
      ? { ...l, styled: { ...FILL[l.kind], ...l.style } }
      : l)),
    [layers],
  )

  return (
    <MapContainer
      center={INDIA}
      zoom={4.5}
      minZoom={3}
      maxZoom={12}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {styled.map((l) => (l.data
        ? <GeoJSON key={l.key} data={l.data} style={l.styled} />
        : null))}
      <FitBounds geojson={primary} />
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
