import { useEffect, useState } from 'react'

const BASE = `${import.meta.env.BASE_URL}data`

/** Fetch a GeoJSON file, with the previous value kept until the new one lands. */
export function useGeoJson(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!path) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`${BASE}/${path}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${path}`)
        return r.json()
      })
      .then((json) => {
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [path])

  return { data, error, loading }
}
