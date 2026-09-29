/**
 * Selection state machine: India -> State -> District -> Sub-district.
 *
 * Deliberately knows nothing about any map library. It returns plain values
 * (state / district / subdistrict objects from index.json) plus callbacks, so
 * the same selection drives the tree, the map layers, and the legend.
 */
import { useCallback, useMemo, useState } from 'react'

export function useSelection() {
  const [state, setState] = useState(null)
  const [district, setDistrict] = useState(null)
  const [subdistrict, setSubdistrict] = useState(null)

  const level = subdistrict ? 'subdistrict'
    : district ? 'district'
      : state ? 'state'
        : 'country'

  const selectState = useCallback((s) => {
    setState(s)
    setDistrict(null)
    setSubdistrict(null)
  }, [])

  // A state with no district file (the four cross-border polygons) cannot be
  // drilled into, so ignore the click rather than stranding the user.
  const selectDistrict = useCallback((d) => {
    if (d && !d.subdistrict_files?.length) return
    setDistrict(d || null)
    setSubdistrict(null)
  }, [])

  const selectSubdistrict = useCallback((sd) => setSubdistrict(sd || null), [])

  const goHome = useCallback(() => {
    setState(null)
    setDistrict(null)
    setSubdistrict(null)
  }, [])

  // Breadcrumbs jump straight to a level rather than stepping back one at a time.
  const goTo = useCallback((to) => {
    if (to === 'country') {
      setState(null)
      setDistrict(null)
      setSubdistrict(null)
    } else {
      setDistrict(null)
      setSubdistrict(null)
    }
  }, [])

  /** Resolve a clicked feature back to its node in the index, by name or code. */
  const pickStateByProps = useCallback((props, states) => {
    if (!props || !states) return null
    return states.find((s) => s.name === props.state_name) || null
  }, [])

  const pickDistrictByProps = useCallback((props) => {
    if (!props || !state) return null
    return state.districts.find(
      (d) => d.name === props.district_name || (props.district_lgd && d.code === props.district_lgd),
    ) || null
  }, [state])

  const pickSubdistrictByProps = useCallback((props) => {
    if (!props || !district) return null
    const i = district.subdistricts.findIndex(
      (s) => s.name === props.subdistrict_name
        && String(s.code) === String(props.subdistrict_lgd),
    )
    return i >= 0 ? { ...district.subdistricts[i], district, index: i } : null
  }, [district])

  return useMemo(() => ({
    state, district, subdistrict, level,
    selectState, selectDistrict, selectSubdistrict,
    goHome, goTo,
    pickStateByProps, pickDistrictByProps, pickSubdistrictByProps,
  }), [
    state, district, subdistrict, level,
    selectState, selectDistrict, selectSubdistrict, goHome, goTo,
    pickStateByProps, pickDistrictByProps, pickSubdistrictByProps,
  ])
}
