// NB: import as OLMap, not Map — it would shadow the built-in Map used below.
import { useEffect, useRef, useState } from 'react'
import OLMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import GeoJSON from 'ol/format/GeoJSON'
import { Style, Fill, Stroke, Text } from 'ol/style'
import { openlayersUrls } from '../config/basemaps'
import { colorFor, fillFor } from '../config/palette'
import 'ol/ol.css'

/** Single-colour styling for the national context layers. */
const STYLE = {
  states: { color: '#2563eb', width: 1, fill: 0.15 },
  districts: { color: '#0d9488', width: 0.8, fill: 0.2 },
  subdistricts: { color: '#b45309', width: 0.5, fill: 0.3 },
  disputed: { color: '#dc2626', width: 1, dash: [6, 4], fill: 0.15 },
}

// App passes Leaflet-shaped overrides (weight / fillOpacity / dashArray) so both
// engines can be driven from one layer definition; translate them here.
function baseStyle(kind, over) {
  const b = STYLE[kind] || STYLE.states
  return {
    color: over?.color ?? b.color,
    width: over?.weight ?? over?.width ?? b.width,
    alpha: over?.fillOpacity ?? over?.fill ?? b.fill,
    dash: over?.dashArray
      ? String(over.dashArray).split(',').map((n) => parseFloat(n))
      : b.dash,
  }
}

function makeStyleFunction(kind, over) {
  const b = baseStyle(kind, over)
  const labelFor = (feature) => (over?.labels
    ? new Text({ text: feature.get('ompName') || '', fill: new Fill({ color: '#0f172a' }) })
    : undefined)
  const flat = (feature) => new Style({
    stroke: new Stroke({ color: b.color, width: b.width, lineDash: b.dash }),
    fill: new Fill({ color: b.color, fillOpacity: b.alpha }),
    text: labelFor(feature),
  })

  if (over?.categorical) {
    // Colour by position within the group so adjacent polygons differ.
    return (feature) => new Style({
      stroke: new Stroke({ color: colorFor(feature.get('ompIndex') ?? 0), width: b.width }),
      fill: new Fill({ color: fillFor(feature.get('ompIndex') ?? 0, b.alpha) }),
      text: labelFor(feature),
    })
  }

  if (over?.emphasis) {
    // Single out the feature in focus; leave its neighbours muted.
    const { key, value, color, weight, alpha = 0.12 } = over.emphasis
    return (feature) => (feature.get(key) === value
      ? new Style({
        stroke: new Stroke({ color, width: weight }),
        fill: new Fill({ color, fillOpacity: alpha }),
      })
      : flat())
  }

  return flat
}

export default function MapViewOL({ layers, legend, basemap }) {
  const el = useRef(null)
  const mapRef = useRef(null)
  const layerRefs = useRef(new Map())
  const [tip, setTip] = useState(null)

  useEffect(() => {
    const map = new OLMap({
      target: el.current,
      layers: [],
      view: new View({
        projection: 'EPSG:4326',
        center: [79, 22.5],
        zoom: 4.5,
        minZoom: 3,
        maxZoom: 14,
      }),
    })
    mapRef.current = map

    // Hover name, and click-to-drill, resolved by hit detection.
    const onMove = (evt) => {
      let hit
      map.forEachFeatureAtPixel(evt.pixel, (f) => { hit = f; return true })
      if (!hit || hit.get('ompName') == null) { setTip(null); return }
      // evt.pixel is already relative to the map viewport, which shares its
      // origin with .ol-wrap, so the tip can be positioned directly from it.
      setTip({ text: hit.get('ompName'), at: [evt.pixel[0], evt.pixel[1]] })
    }
    const onOut = () => setTip(null)
    const onClick = (evt) => {
      let hit
      map.forEachFeatureAtPixel(evt.pixel, (f) => { hit = f; return true })
      const cb = hit?.get('ompOnClick')
      if (cb) cb(hit.get('ompProps') || {})
    }
    map.on('pointermove', onMove)
    map.on('pointerout', onOut)
    map.on('click', onClick)
    return () => {
      map.un('pointermove', onMove)
      map.un('pointerout', onOut)
      map.un('click', onClick)
      map.setTarget(undefined)
      mapRef.current = null
    }
  }, [])

  // Basemap: one XYZ source per provider, rebuilt when the provider changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !basemap) return
    const layer = new TileLayer({
      source: new XYZ({
        urls: openlayersUrls(basemap),
        attributions: basemap.attribution,
        maxZoom: basemap.maxZoom ?? 19,
        crossOrigin: 'anonymous',
      }),
    })
    map.getLayers().insertAt(0, layer)
    map.getView().setMaxZoom(basemap.maxZoom ?? 14)
    return () => map.getLayers().remove(layer)
  }, [basemap])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const holder = layerRefs.current

    for (const key of [...holder.keys()]) {
      if (!layers.some((l) => l.key === key)) {
        map.removeLayer(holder.get(key))
        holder.delete(key)
      }
    }

    layers.forEach((l, i) => {
      if (!l.data) return
      if (holder.get(l.key)?.get('ompData') === l.data) return

      const nameKey = l.nameKey || (l.kind === 'states' ? 'state_name' : `${l.kind}_name`)
      const features = new GeoJSON().readFeatures(l.data, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:4326',
      })
      // Position within the group, so categorical colours line up with Leaflet.
      features.forEach((f, n) => {
        f.set('ompIndex', n)
        f.set('ompName', f.get(nameKey) || null)
        if (l.onClick) {
          f.set('ompOnClick', l.onClick)
          f.set('ompProps', {
            district_lgd: f.get('district_lgd'),
            district_name: f.get('district_name'),
          })
        }
      })

      if (holder.get(l.key)) map.removeLayer(holder.get(l.key))
      const vector = new VectorLayer({
        source: new VectorSource({ features }),
        style: makeStyleFunction(l.kind, { ...l.style, categorical: l.categorical }),
      })
      vector.set('ompKey', l.key)
      vector.set('ompData', l.data)
      map.getLayers().insertAt(i + 1, vector)
      holder.set(l.key, vector)
    })

    // Frame the most specific layer, or a single feature when one is focused.
    const primary = layers.filter((l) => l.data).at(-1)
    if (primary) {
      const src = holder.get(primary.key)?.getSource()
      if (src && !src.isEmpty()) {
        let feats = src.getFeatures()
        if (primary.focus) feats = feats.filter(primary.focus.matchesOL)
        const extent = feats.length
          ? feats.reduce((acc, f) => acc.concat(f.getGeometry().getExtent()), [])
          : null
        // view.fit() indexes 0..3, so a degenerate or non-finite extent (a
        // zero-area or collapsed geometry) has to be rejected before it is
        // passed, otherwise it throws and takes the map down.
        const size = map.getSize() || [map.getTargetElement().clientWidth, map.getTargetElement().clientHeight]
        const ok = Array.isArray(extent)
          && extent.length === 4
          && extent.every(Number.isFinite)
          && extent[0] <= extent[2] && extent[1] <= extent[3]
        if (ok && size[0] > 0 && size[1] > 0) {
          map.getView().fit(extent, {
            size,
            padding: [24, 24, 24, 24],
            maxZoom: 13,
          })
        }
      }
    }
  }, [layers])

  return (
    <div className="ol-wrap">
      <div ref={el} className="ol-map" />
      {tip && (
        <div className="omp-tip ol-tip" style={{ left: tip.at[0] + 12, top: tip.at[1] + 12 }}>
          {tip.text}
        </div>
      )}
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
