import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import { useGeoJson } from './hooks/useGeoJson'
import { availableBasemaps } from './config/basemaps'
import { useSelection } from './state/selection'
import { buildLayers, buildLegend } from './state/layers'
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

  const basemaps = useMemo(() => availableBasemaps(), [])
  const [basemapId, setBasemapId] = useState('osm')
  const basemap = useMemo(
    () => basemaps.find((b) => b.id === basemapId) ?? basemaps[0],
    [basemaps, basemapId],
  )
  useEffect(() => {
    if (!basemaps.some((b) => b.id === basemapId) && basemaps[0]) setBasemapId(basemaps[0].id)
  }, [basemaps, basemapId])

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
    labels, focus, handlers,
  }), [level, states, districtLayer, subLayer, state, district, subdistrict, labels, focus, handlers])

  const legend = useMemo(() => buildLegend({
    level, states, districtLayer, subLayer, state, district, subdistrict,
  }), [level, states, districtLayer, subLayer, state, district, subdistrict])

  const busy = dLoading || sLoading

  return (
    <div className="app">
      <Sidebar
        index={index}
        selection={sel}
        onToggleUnassigned={() => { setShowUnassigned((v) => !v); sel.goHome() }}
      />
      <main className="map-pane">
        <div className="map-controls">
          <label className="basemap-pick">
            <span className="sr-only">Basemap</span>
            <select value={basemap?.id} onChange={(e) => setBasemapId(e.target.value)}>
              {basemaps.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
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

        <div className="label-toggles" role="group" aria-label="Labels">
          {['states', 'districts', 'subdistricts'].map((k) => (
            <label key={k} className={labels[k] ? 'on' : ''}>
              <input type="checkbox" checked={labels[k]} onChange={() => toggleLabel(k)} />
              {k === 'states' ? 'States' : k === 'districts' ? 'Districts' : 'Sub-districts'}
            </label>
          ))}
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
