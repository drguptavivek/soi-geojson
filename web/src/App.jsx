import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import { useGeoJson } from './hooks/useGeoJson'
import { availableBasemaps } from './config/basemaps'
import { useSelection } from './state/selection'
import { buildLayers, buildLegend } from './state/layers'
import LayersControl from './components/LayersControl'
import { exportFeatures } from './lib/csv'
import './styles.css'

// OpenLayers is only fetched when the user switches to it, so Leaflet-only
// visitors do not download it.
const MapViewOL = lazy(() => import('./components/MapViewOL'))

export default function App() {
  const { data: index } = useGeoJson('index.json')
  const sel = useSelection()
  const { state, district, subdistrict, level } = sel

  const [engine, setEngine] = useState('leaflet')
  const [labels, setLabels] = useState({ states: true, districts: false, subdistricts: false })
  const toggleLabel = useCallback(
    (k) => setLabels((l) => ({ ...l, [k]: !l[k] })), [])
  // Layer keys switched off in the layers control. Kept across selection
  // changes so a user's overlay choices survive a drill-down.
  const [hidden, setHidden] = useState(() => new Set())
  const toggleLayer = useCallback(
    (k) => setHidden((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    }), [])
  const [layersOpen, setLayersOpen] = useState(false)

  const basemaps = useMemo(() => availableBasemaps(), [])
  const [basemapId, setBasemapId] = useState(null)
  const basemap = useMemo(
    () => basemaps.find((b) => b.id === basemapId),
    [basemaps, basemapId],
  )

  const { data: states } = useGeoJson('states.geojson')
  const { data: districtLayer, loading: dLoading } = useGeoJson(state?.file || null)
  const { data: subLayer, loading: sLoading } = useGeoJson(
    district?.subdistrict_files?.[0] || null,
  )

  // A clicked polygon resolves back to its node in the index, then goes through
  // exactly the same reducer the tree uses.
  const handlers = useMemo(() => ({
    state: (props) => {
      const s = sel.pickStateByProps(props, index?.states)
      if (s?.file) sel.selectState(s)
    },
    district: (props) => sel.selectDistrict(sel.pickDistrictByProps(props)),
    subdistrict: (props) => {
      const sd = sel.pickSubdistrictByProps(props)
      if (sd) sel.selectSubdistrict(sd)
    },
  }), [sel, index])

  // Zoom to a single sub-district when one is selected.
  const focus = useMemo(() => {
    if (!subLayer || !subdistrict) return undefined
    const same = (name, code) => (f) => f.properties.subdistrict_name === name
      && String(f.properties.subdistrict_lgd) === String(code)
    return {
      matches: same(subdistrict.name, subdistrict.code),
      matchesOL: (f) => f.get('subdistrict_name') === subdistrict.name
        && String(f.get('subdistrict_lgd')) === String(subdistrict.code),
    }
  }, [subLayer, subdistrict])

  const layers = useMemo(() => buildLayers({
    level, states, districtLayer, subLayer, state, district, subdistrict,
    labels, focus, handlers, hidden,
  }), [level, states, districtLayer, subLayer, state, district, subdistrict, labels, focus, handlers, hidden])
  const legend = useMemo(() => buildLegend({
    level, states, districtLayer, subLayer, state, district, subdistrict, hidden,
  }), [level, states, districtLayer, subLayer, state, district, subdistrict, hidden])

  // Which overlays the control should offer: the keys buildLayers() would emit
  // right now. Derived before `hidden` is applied, so switching a layer off
  // leaves its checkbox in the panel rather than making it vanish.
  const availableLayerKeys = useMemo(() => buildLayers({
    level, states, districtLayer, subLayer, state, district, subdistrict,
    labels, focus, handlers,
  }).map((l) => l.key), [level, states, districtLayer, subLayer, state, district, subdistrict, labels, focus, handlers])


  // Export whatever the map is currently showing at this level. The geometry is
  // already loaded at every level, so this always produces attributes + WKT.
  const exportScope = useCallback(() => {
    if (level === 'country' && states) exportFeatures(states, 'states', 'india')
    else if (level === 'state' && districtLayer) {
      exportFeatures(districtLayer, 'districts', state?.name)
    } else if (subLayer) {
      exportFeatures(subLayer, 'subdistricts', district?.name)
    }
  }, [level, states, districtLayer, subLayer, state, district])
  const busy = dLoading || sLoading

  return (
    <div className="app">
      <Sidebar
        index={index}
        selection={sel}
        onExportScope={exportScope}
      />
      <main className="map-pane">
        <div className="map-controls">
          <LayersControl
            basemaps={basemaps}
            basemap={basemap}
            onBasemap={setBasemapId}
            available={availableLayerKeys}
            hidden={hidden}
            onToggleLayer={toggleLayer}
            labels={labels}
            onToggleLabel={toggleLabel}
            open={layersOpen}
            onToggleOpen={() => setLayersOpen((v) => !v)}
          />
          <div className="engine-switch" role="group" aria-label="Map engine">
            {['leaflet', 'openlayers'].map((e) => (
              <button
                key={e}
                className={engine === e ? 'on' : ''}
                onClick={() => setEngine(e)}
              >
                {e === 'leaflet' ? 'Leaflet' : 'OpenLayers'}
              </button>
            ))}
          </div>
        </div>

        {engine === 'leaflet' ? (
          <MapView layers={layers} legend={legend} basemap={basemap} />
        ) : (
          <Suspense fallback={<div className="loading">loading OpenLayers…</div>}>
            <MapViewOL layers={layers} legend={legend} basemap={basemap} />
          </Suspense>
        )}
        {busy && <div className="loading">loading geometry…</div>}
      </main>
    </div>
  )
}
