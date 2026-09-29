/**
 * Tree filtering, as pure functions over index.json.
 *
 * No React and no map library, so the tree and any future consumer (search, a
 * command palette, a test) filter identically.
 *
 * A query matches anywhere in the branch: typing a sub-district name still
 * surfaces its district and state, so the path to a match is never hidden.
 */
const norm = (s) => (s || '').toLowerCase()

const hit = (query, name, code) =>
  !query || norm(name).includes(norm(query)) || (code || '').toLowerCase().includes(norm(query))

/**
 * States to list, given the current selection.
 *
 * The selection scopes the list: at country level you see every state, but once
 * a state is open the sibling states are folded away so the branch in focus --
 * and the node currently selected inside it -- is what you are looking at.
 */
export function visibleStates(states, query, { openState, openDistrict, level }) {
  const all = (states || []).filter((s) => hit(query, s.name, s.code))
  const scoped = level === 'country'
    ? all
    : all.filter((s) => (s.code || s.name) === openState)
  return [...scoped].sort((a, b) => {
    if (!!a.code !== !!b.code) return a.code ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/** Districts of `state` matching the query. */
export function filterDistricts(state, query) {
  const ds = state?.districts || []
  if (!query) return ds
  return ds.filter((d) => hit(query, d.name, d.code)
    || d.subdistricts.some((s) => hit(query, s.name, s.code)))
}

/** Sub-districts of `district` matching the query. */
export function filterSubdistricts(district, query) {
  const ss = district?.subdistricts || []
  return query ? ss.filter((s) => hit(query, s.name, s.code)) : ss
}

/** True while a query is active, which auto-expands every matching branch. */
export const isSearching = (query) => !!query && query.trim() !== ''

export const counts = (states) => {
  const s = states || []
  return {
    states: s.length,
    districts: s.reduce((n, x) => n + x.districts.length, 0),
    subdistricts: s.reduce(
      (n, x) => n + x.districts.reduce((m, d) => m + d.subdistricts.length, 0), 0),
  }
}
