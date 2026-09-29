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
import Point from 'ol/geom/Point'
import { openlayersUrls } from '../config/basemaps'
import { colorFor, fillFor } from '../config/palette'

/** Single-colour styling for the national context layers. */
const STYLE = {
  states: { color: '#2563eb', width: 1, fill: 0.15 },
  districts: { color: '#0d9488', width: 0.8, fill: 0.2 },
  subdistricts: { color: '#b45309', width: 0.5, fill: 0.3 },
  outline: { color: '#475569', width: 1.4, fill: 0 },
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
    ? new Text({
      text: feature.get('ompName') || '',
      fill: new Fill({ color: '#0f172a' }),
      geometry: () => {
        const lon = Number(feature.get('label_lon'))
        const lat = Number(feature.get('label_lat'))
        return Number.isFinite(lon) && Number.isFinite(lat)
          ? new Point([lon, lat])
          : feature.getGeometry()
      },
    })
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
    // evt.pixel is already relative to the map viewport, which shares its
    // origin with .ol-wrap, so the tip can be positioned directly from it.
    const hitAt = (evt) => {
      if (!evt?.pixel || evt.pixel.length < 2) return null
      let found = null
      map.forEachFeatureAtPixel(evt.pixel, (f) => { found = f; return true })
      return found
    }
    const onMove = (evt) => {
      const hit = hitAt(evt)
      const name = hit?.get('ompName')
      if (!name) { setTip(null); return }
      setTip({ text: name, at: [evt.pixel[0], evt.pixel[1]] })
    }
    const onOut = () => setTip(null)
    const onClick = (evt) => {
      const hit = hitAt(evt)
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

    // Rebuild only layers whose data or presentation changed -- re-parsing
    // thousands of coordinates on every state change is far too slow.
    // Ordering is fixed separately below, by re-adding the managed layers in
    // sequence: insertAt(i + 1) with the *array* index cannot work, because the
    // collection also holds the basemap and unchanged layers are not re-added,
    // so the index can outrun the collection and Collection.insertAt throws.
    const sig = (l) => JSON.stringify([l.categorical, l.style, l.labels, l.emphasis, l.nameKey])

    for (const l of layers) {
      if (!l.data) continue
      const existing = holder.get(l.key)
      if (existing && existing.get('ompData') === l.data && existing.get('ompSig') === sig(l)) {
        continue
      }
      if (existing) map.removeLayer(existing)

      const features = new GeoJSON().readFeatures(l.data, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:4326',
      })
      // Position within the group, so categorical colours line up with Leaflet.
      features.forEach((f, n) => {
        f.set('ompIndex', n)
        f.set('ompName', f.get(l.nameKey) || null)
        if (l.onClick) {
          f.set('ompOnClick', l.onClick)
          f.set('ompProps', {
            district_lgd: f.get('district_lgd'),
            district_name: f.get('district_name'),
            subdistrict_lgd: f.get('subdistrict_lgd'),
            subdistrict_name: f.get('subdistrict_name'),
          })
        }
      })

      const vector = new VectorLayer({
        source: new VectorSource({ features }),
        style: makeStyleFunction(l.kind, {
          ...l.style,
          categorical: l.categorical,
          labels: l.labels,
        }),
      })
      vector.set('ompKey', l.key)
      vector.set('ompData', l.data)
      vector.set('ompSig', sig(l))
      holder.set(l.key, vector)
    }

    // Enforce general -> specific ordering, and drop anything no longer listed.
    const wanted = layers.filter((l) => l.data).map((l) => holder.get(l.key)).filter(Boolean)
    for (const layer of [...holder.values()]) {
      if (!wanted.includes(layer)) {
        map.removeLayer(layer)
        holder.delete(layer.get('ompKey'))
      }
    }
    // Re-order only when it is actually wrong: re-adding every layer on each
    // run is pure churn and leaves the map fighting itself.
    const inMap = map.getLayers().getArray().filter((l) => holder.get(l.get('ompKey')) === l)
    const ordered = inMap.length === wanted.length && inMap.every((l, i) => l === wanted[i])
    if (!ordered) {
      for (const layer of wanted) map.getLayers().remove(layer)
      for (const layer of wanted) map.addLayer(layer)
    }

    // Frame the most specific layer, or a single feature when one is focused.
    const primary = layers.filter((l) => l.data).at(-1)
    if (primary) {
      const src = holder.get(primary.key)?.getSource()
      if (src && !src.isEmpty()) {
        let feats = src.getFeatures()
        if (primary.focus) feats = feats.filter(primary.focus.matchesOL)
        // Union of the selected features' extents. Concatenating them would
        // give 4*N numbers, which view.fit() then indexes as if it were 4.
        let extent = null
        for (const f of feats) {
          const e = f.getGeometry()?.getExtent()
          if (!e || !e.every(Number.isFinite)) continue
          if (!extent) {
            extent = e.slice()
          } else {
            extent[0] = Math.min(extent[0], e[0])
            extent[1] = Math.min(extent[1], e[1])
            extent[2] = Math.max(extent[2], e[2])
            extent[3] = Math.max(extent[3], e[3])
          }
        }
        const target = map.getTargetElement()
        const size = (map.getSize() && map.getSize().length === 2
          ? map.getSize()
          : [target?.clientWidth ?? 0, target?.clientHeight ?? 0])
        if (extent && extent.length === 4 && size[0] > 0 && size[1] > 0) {
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
