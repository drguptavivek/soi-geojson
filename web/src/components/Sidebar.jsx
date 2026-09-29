import { useEffect, useMemo, useState } from 'react'
import { visibleStates, filterDistricts, filterSubdistricts, isSearching, counts } from '../state/filters'

const EMPTY = []

/**
 * The source names the four cross-border polygons 'DISPUTED (A & B)'. That
 * wording is the publisher's, not ours -- the UI shows a neutral label while
 * the data keeps the original value.
 */
const displayName = (n) =>
  (n || '').replace(/^DISPUTED\s*\((.*)\)$/i, 'Boundary area — $1')

/**
 * State > District > Sub-district, as one tree with connector rules.
 *
 * All selection and filtering comes from ../state, so this component is purely
 * presentation and knows nothing about the map.
 */
export default function Sidebar({ index, selection, onToggleUnassigned, unassigned }) {
  const [q, setQ] = useState('')
  const [openState, setOpenState] = useState(null)
  const [openDistrict, setOpenDistrict] = useState(null)

  const { state, district, subdistrict, level } = selection
  const { selectState, selectDistrict, selectSubdistrict, goTo } = selection
  const states = index?.states ?? EMPTY
  const searching = isSearching(q)

  // Clear the query on drill-down so a country-level search cannot silently
  // empty the branch the user then opens.
  useEffect(() => setQ(''), [state?.code, district?.code, subdistrict?.code])

  // Keep the tree open onto whatever is selected, so the node in focus is
  // never hidden behind a collapsed parent.
  useEffect(() => {
    if (state) setOpenState(state.code || state.name)
  }, [state])
  useEffect(() => {
    if (state && district) {
      setOpenDistrict(`${state.code || state.name}/${district.code}/${district.name}`)
    }
  }, [state, district])

  const shownStates = useMemo(
    () => visibleStates(states, q, { openState, level }),
    [states, q, openState, level])
  const openStateObj = useMemo(
    () => states.find((s) => (s.code || s.name) === openState) || null,
    [states, openState])
  const openDistrictObj = useMemo(
    () => openStateObj?.districts.find(
      (d) => `${openState}/${d.code}/${d.name}` === openDistrict) || null,
    [openStateObj, openState, openDistrict])
  const visibleDistricts = useMemo(
    () => (openStateObj ? filterDistricts(openStateObj, q) : EMPTY),
    [openStateObj, q],
  )
  const visibleSubs = useMemo(
    () => (openDistrictObj ? filterSubdistricts(openDistrictObj, q) : EMPTY),
    [openDistrictObj, q],
  )
  const n = useMemo(() => counts(states), [states])

  return (
    <aside className="sidebar">
      <header>
        <h1>India &mdash; Administrative Boundaries</h1>
        <p className="sub">Survey of India &middot; LGD codes &middot; WGS84 (EPSG:4326)</p>
      </header>

      <label className="search">
        <input
          type="search"
          placeholder="Filter states, districts, sub-districts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>


      <nav className="crumbs" aria-label="Breadcrumb">
        <button
          className={!state ? 'on' : ''}
          onClick={() => { goTo('country'); setOpenState(null); setOpenDistrict(null) }}
        >
          India
        </button>
        {state && (
          <>
            <span className="sep">&rsaquo;</span>
            <button
              className={level === 'state' ? 'on' : 'parent'}
              onClick={() => { goTo('state'); setOpenDistrict(null) }}
            >
              {state.name}
            </button>
          </>
        )}
        {district && (
          <>
            <span className="sep">&rsaquo;</span>
            <button
              className={level === 'district' || level === 'subdistrict' ? 'on' : 'parent'}
              onClick={() => { goTo('state') }}
            >
              {district.name}
            </button>
          </>
        )}
        {subdistrict && (
          <>
            <span className="sep">&rsaquo;</span>
            <button className="on" disabled>{subdistrict.name || '(unnamed)'}</button>
          </>
        )}
        {level !== 'country' && (
          <button
            className="up"
            onClick={() => goTo(level === 'subdistrict' ? 'district'
              : level === 'district' ? 'state' : 'country')}
          >
            &uarr; up
          </button>
        )}
      </nav>

      <div className="list-head">
        <span>{n.states} states</span>
        <span className="code">{n.districts} districts &middot; {n.subdistricts} sub</span>
      </div>

      <ul className="list tree">
        {shownStates.map((s) => {
          const key = s.code || s.name
          const openS = openState === key || searching
          const on = !!state && state.code === s.code && s.code !== ''
          return (
            <li key={`s-${key}`}>
              <div className={`row ${on ? 'on' : ''}`}>
                <button
                  className="caret"
                  onClick={() => { setOpenState(openS ? null : key); setOpenDistrict(null) }}
                  aria-label={openS ? 'collapse' : 'expand'}
                  aria-expanded={openS}
                />
                <button
                  className="label"
                  onClick={() => { setOpenState(key); setOpenDistrict(null); selectState(s) }}
                  disabled={!s.file}
                  title={s.file ? `${s.districts.length} districts` : 'Cross-border area — no district layer'}
                >
                  {displayName(s.name)}
                </button>
                <span className="cd">{s.code || '—'}</span>
              </div>

              {openS && (
                <ul className="list nested">
                  {(searching ? s.districts.filter((d) => visibleDistricts.some((v) => v.code === d.code && v.name === d.name)) : s.districts)
                    .map((d) => {
                      const dkey = `${key}/${d.code}/${d.name}`
                      const openD = openDistrict === dkey || searching
                      const onD = !!district && district.code === d.code && district.name === d.name
                      return (
                        <li key={`d-${dkey}`}>
                          <div className={`row ${onD ? 'on' : ''}`}>
                            <button
                              className="caret"
                              onClick={() => { setOpenState(key); setOpenDistrict(openD ? null : dkey) }}
                              aria-label={openD ? 'collapse' : 'expand'}
                              aria-expanded={openD}
                            />
                            <button
                              className="label"
                              onClick={() => { setOpenState(key); setOpenDistrict(dkey); selectDistrict(d) }}
                              disabled={!d.subdistrict_files.length}
                              title={d.subdistrict_files.length
                                ? `${d.subdistricts.length} sub-districts`
                                : 'No sub-district geometry in the source data'}
                            >
                              {displayName(d.name)}
                            </button>
                            <span className="cd">{d.code || '—'}</span>
                          </div>

                          {openD && (
                            <ul className="list nested">
                              {(searching
                                ? d.subdistricts.filter((sd) => visibleSubs.some((v) => v.code === sd.code && v.name === sd.name))
                                : d.subdistricts
                              ).map((sd, i) => {
                                const onS = subdistrict?.code === sd.code && subdistrict?.name === sd.name
                                return (
                                  <li key={`u-${d.code}-${sd.code}-${i}`}>
                                    <div className={`row ${onS ? 'on' : ''}`}>
                                      <span className="dot" />
                                      <button
                                        className="label"
                                        onClick={() => selectSubdistrict({ ...sd, district: d, index: i })}
                                      >
                                        {sd.name || '(unnamed)'}
                                      </button>
                                      <span className="cd">{sd.code || '—'}</span>
                                    </div>
                                  </li>
                                )
                              })}
                              {!d.subdistricts.length && (
                                <li className="row empty">no sub-district data</li>
                              )}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      <button className={`disputed ${unassigned ? 'on' : ''}`} onClick={onToggleUnassigned}>
        {unassigned ? 'Hide' : 'Show'} 28 unassigned areas
      </button>

      <footer>
        <p>{index ? `${n.states} states · ${n.districts} districts · ${n.subdistricts} sub-districts` : 'loading index…'}</p>
        <p className="note">
          Geometry is simplified for display. Use the full-resolution GeoJSON in the data
          folder for analysis.
        </p>
      </footer>
    </aside>
  )
}
