import { useEffect, useRef } from 'react'
// NB: import as OLMap, not Map — it would shadow the built-in Map used below.
import OLMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import GeoJSON from 'ol/format/GeoJSON'
import { Style, Fill, Stroke } from 'ol/style'
import 'ol/ol.css'

/** Same palette as the Leaflet view so the two engines are comparable. */
const STYLE = {
  states: { color: '#2563eb', width: 1, fill: 0.15 },
  districts: { color: '#0d9488', width: 0.8, fill: 0.2 },
  subdistricts: { color: '#b45309', width: 0.5, fill: 0.3 },
  disputed: { color: '#dc2626', width: 1, dash: [6, 4], fill: 0.15 },
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// App passes Leaflet-shaped overrides (weight / fillOpacity / dashArray) so both
// engines can be driven from one layer definition; translate them here.
function toStyle(kind, over) {
  const b = STYLE[kind] || STYLE.states
  const color = over?.color ?? b.color
  const width = over?.weight ?? over?.width ?? b.width
  const alpha = over?.fillOpacity ?? over?.fill ?? b.fill
  const dash = over?.dashArray
    ? String(over.dashArray).split(',').map((n) => parseFloat(n))
    : b.dash
  return new Style({
    stroke: new Stroke({ color, width, lineDash: dash }),
    fill: new Fill({ color: rgba(color, alpha) }),
  })
}

export default function MapViewOL({ layers, legend }) {
  const el = useRef(null)
  const mapRef = useRef(null)
  const layerRefs = useRef(new Map())

  // Create the map once; layers are kept in sync by the effect below.
  useEffect(() => {
    const map = new OLMap({
      target: el.current,
      layers: [
        new TileLayer({ source: new OSM({ attributions: '© OpenStreetMap contributors' }) }),
      ],
      view: new View({ projection: 'EPSG:4326', center: [79, 22.5], zoom: 4.5, minZoom: 3, maxZoom: 14 }),
    })
    mapRef.current = map
    return () => {
      map.setTarget(undefined)
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const holder = layerRefs.current

    // drop layers that are no longer present
    for (const key of [...holder.keys()]) {
      if (!layers.some((l) => l.key === key)) {
        map.removeLayer(holder.get(key))
        holder.delete(key)
      }
    }

    layers.forEach((l, i) => {
      if (!l.data) return
      const source = new VectorSource({
        features: new GeoJSON().readFeatures(l.data, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:4326',
        }),
      })
      const vector = new VectorLayer({ source, style: toStyle(l.kind, l.style) })
      // keep general -> specific ordering, as the Leaflet view does
      const at = map.getLayers().getArray().findIndex((x) => x.get('ompKey') === l.key)
      if (at >= 0) {
        map.removeLayer(holder.get(l.key))
        holder.delete(l.key)
      }
      map.getLayers().insertAt(i + 1, vector)
      vector.set('ompKey', l.key)
      holder.set(l.key, vector)
    })

    // frame the most specific layer, matching the Leaflet behaviour
    const primary = layers.filter((l) => l.data).at(-1)
    if (primary) {
      const src = holder.get(primary.key)?.getSource()
      if (src && !src.isEmpty()) {
        map.getView().fit(src.getExtent(), {
          size: map.getSize(),
          padding: [24, 24, 24, 24],
          maxZoom: 11,
        })
      }
    }
  }, [layers])

  return (
    <div className="ol-wrap">
      <div ref={el} className="ol-map" />
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
    </div>
  )
}
