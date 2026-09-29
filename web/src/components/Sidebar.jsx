import { useEffect, useMemo, useState } from 'react'

function norm(s) {
  return (s || '').toLowerCase()
}

const EMPTY = []

export default function Sidebar({
  index, level, state, district, onSelectState, onSelectDistrict, onNavigate, onShowDisputed,
}) {
  const [q, setQ] = useState('')

  // The filter box is scoped to the level you are viewing, so clear it on every
  // level change — otherwise a country-level search silently empties the
  // district list of whatever state you then pick.
  useEffect(() => setQ(''), [level, state?.code, district?.name])

  // Stable identity, or the useMemo deps below change on every render.
  const states = index?.states ?? EMPTY
  const districts = state?.districts ?? EMPTY

  // Coded states first, then the disputed polygons, which have no code.
  const visibleStates = useMemo(() => {
    const n = norm(q)
    const list = n
      ? states.filter((s) => norm(s.name).includes(n) || s.code.includes(n))
      : states
    return [...list].sort((a, b) => {
      if (!!a.code !== !!b.code) return a.code ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [states, q])

  const visibleDistricts = useMemo(() => {
    const n = norm(q)
    if (!n) return districts
    return districts.filter((d) => norm(d.name).includes(n) || (d.code || '').toLowerCase().includes(n))
  }, [districts, q])

  const showDistricts = level !== 'country'
  const count = showDistricts ? visibleDistricts.length : visibleStates.length

  return (
    <aside className="sidebar">
      <header>
        <h1>India &mdash; Administrative Boundaries</h1>
        <p className="sub">
          Survey of India &middot; LGD codes &middot; WGS84 (EPSG:4326)
        </p>
      </header>

      <nav className="crumbs">
        <button className={level === 'country' ? 'on' : ''} onClick={() => onNavigate('country')} disabled={level === 'country'}>
          India
        </button>
        {state && (
          <button className={level === 'state' ? 'on' : ''} onClick={() => onNavigate('state')} disabled={level === 'state'}>
            {state.name}
          </button>
        )}
        {district && (
          <button className="on" disabled>{district.name}</button>
        )}
      </nav>

      <label className="search">
        <input
          type="search"
          placeholder={showDistricts ? 'Filter districts…' : 'Filter states…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      <div className="list-head">
        <span>{count} {showDistricts ? 'districts' : 'states'}</span>
        {state && <span className="code">LGD {state.code || '—'}</span>}
      </div>

      <ul className="list">
        {showDistricts
          ? visibleDistricts.map((d) => (
            <li key={`${d.code}-${d.name}`}>
              <button
                className={level === 'district' && district?.name === d.name ? 'on' : ''}
                onClick={() => onSelectDistrict(d)}
                disabled={!d.subdistrict_files.length}
                title={d.subdistrict_files.length
                  ? undefined
                  : 'No sub-district geometry in the source data for this district'}
              >
                <span className="nm">{d.name}</span>
                <span className="cd">{d.code || '—'}</span>
              </button>
            </li>
          ))
          : visibleStates.map((s) => (
            <li key={`${s.code}-${s.name}`}>
              <button
                className={state?.name === s.name ? 'on' : ''}
                onClick={() => onSelectState(s)}
                disabled={!s.file}
                title={s.file ? undefined : 'Disputed boundary — no district layer'}
              >
                <span className="nm">{s.name}</span>
                <span className="cd">{s.code || '—'}</span>
              </button>
            </li>
          ))}
      </ul>

      {level === 'country' && (
        <button className="disputed" onClick={onShowDisputed}>
          Show 28 disputed districts
        </button>
      )}

      <footer>
        <p>
          {index
            ? `${states.length} states · ${states.reduce((n, s) => n + s.districts.length, 0)} districts with codes`
            : 'loading index…'}
        </p>
        <p className="note">
          Geometry is simplified for display. Use the full-resolution GeoJSON in
          the data folder for analysis.
        </p>
      </footer>
    </aside>
  )
}
