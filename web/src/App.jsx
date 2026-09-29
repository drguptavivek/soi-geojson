import { lazy, Suspense, useCallback, useState } from 'react'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import { useGeoJson } from './hooks/useGeoJson'
import './styles.css'

// OpenLayers is only fetched when the user switches to it, so Leaflet-only
// visitors do not download it.
const MapViewOL = lazy(() => import('./components/MapViewOL'))

const nFeatures = (gj) => (gj ? gj.features.length : 0)

export default function App() {
  const { data: index } = useGeoJson('index.json')
  const [level, setLevel] = useState('country')
  const [state, setState] = useState(null)
  const [district, setDistrict] = useState(null)
  const [showDisputed, setShowDisputed] = useState(false)
  const [engine, setEngine] = useState('leaflet')

  const { data: states } = useGeoJson('states.geojson')
  const { data: disputed } = useGeoJson(showDisputed ? index?.disputed_districts : null)
  const { data: distLayer, loading: dLoading } = useGeoJson(
    level !== 'country' ? state?.file : null,
  )
  const { data: subLayer, loading: sLoading } = useGeoJson(
    level === 'district' ? district?.subdistrict_files?.[0] : null,
  )

  const selectState = useCallback((s) => {
    setState(s)
    setDistrict(null)
    setShowDisputed(false)
    setLevel(s.file ? 'state' : 'country')
  }, [])

  const selectDistrict = useCallback((d) => {
    if (!d.subdistrict_files.length) return
    setDistrict(d)
    setLevel('district')
  }, [])

  // Breadcrumbs jump straight to a level rather than stepping back one at a time.
  const navigate = useCallback((to) => {
    if (to === 'country') {
      setState(null)
      setDistrict(null)
      setShowDisputed(false)
      setLevel('country')
    } else {
      setDistrict(null)
      setShowDisputed(false)
      setLevel('state')
    }
  }, [])


  const layers = []
  if (level === 'country') {
    if (states) layers.push({ key: 'states', kind: 'states', data: states })
    if (disputed) layers.push({ key: 'disputed', kind: 'disputed', data: disputed })
  } else if (level === 'state') {
    if (states) layers.push({ key: 'states', kind: 'states', data: states, style: { weight: 0.5, fillOpacity: 0.03, color: '#94a3b8' } })
    if (distLayer) layers.push({ key: 'districts', kind: 'districts', data: distLayer })
  } else {
    if (states) layers.push({ key: 'states', kind: 'states', data: states, style: { weight: 0.4, fillOpacity: 0.02, color: '#cbd5e1' } })
    if (distLayer) layers.push({ key: 'districts', kind: 'districts', data: distLayer, style: { weight: 0.4, fillOpacity: 0.03, color: '#94a3b8' } })
    if (subLayer) layers.push({ key: 'subs', kind: 'subdistricts', data: subLayer })
  }

  const legend = []
  if (level === 'country') {
    if (states) legend.push({ label: 'States / UTs', color: 'rgba(37,99,235,.35)', count: nFeatures(states) })
    if (disputed) legend.push({ label: 'Disputed districts', color: 'rgba(220,38,38,.35)', count: nFeatures(disputed) })
  } else if (level === 'state') {
    if (distLayer) legend.push({ label: `${state?.name} districts`, color: 'rgba(13,148,136,.35)', count: nFeatures(distLayer) })
  } else if (subLayer) {
    legend.push({ label: `${district?.name} sub-districts`, color: 'rgba(180,83,9,.35)', count: nFeatures(subLayer) })
  }

  const busy = dLoading || sLoading

  return (
    <div className="app">
      <Sidebar
        index={index}
        level={level}
        state={state}
        district={district}
        onSelectState={selectState}
        onSelectDistrict={selectDistrict}
        onNavigate={navigate}
        onShowDisputed={() => { setShowDisputed((v) => !v); setState(null); setLevel('country') }}
      />
      <main className="map-pane">
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
        {engine === 'leaflet' ? (
          <MapView layers={layers} legend={legend} />
        ) : (
          <Suspense fallback={<div className="loading">loading OpenLayers…</div>}>
            <MapViewOL layers={layers} legend={legend} />
          </Suspense>
        )}
        {busy && <div className="loading">loading geometry…</div>}
      </main>
    </div>
  )
}
