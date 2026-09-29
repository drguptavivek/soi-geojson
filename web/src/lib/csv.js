/**
 * CSV export.
 *
 * Two shapes are produced, deliberately:
 *
 *  - Attribute rows straight from the filter index. No geometry, no network
 *    request, so any state or district can be exported without first
 *    navigating to it and loading its GeoJSON.
 *  - Attribute rows plus a WKT geometry column, from a loaded GeoJSON. The
 *    geometry in `public/data` is simplified for display (see TOL in
 *    build_web_data.py), so `wktSimplified` records which tolerance the
 *    coordinates were generalised to and by roughly how much.
 */

/** Quote a single field per RFC 4180. */
export function csvField(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  // Leading/trailing spaces are significant in some parsers, so they force
  // quoting too; a bare quote is doubled.
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s
}

/** Join rows into a CSV document, CRLF-terminated as RFC 4180 specifies. */
export function toCsv(columns, rows) {
  const lines = [columns.map(csvField).join(',')]
  for (const row of rows) lines.push(columns.map((c) => csvField(row[c])).join(','))
  return lines.join('\r\n') + '\r\n'
}

const ring = (coords) => `(${coords.map((p) => `${p[0]} ${p[1]}`).join(', ')})`
// A polygon is a list of rings. GeoJSON guarantees ring 0 is the exterior, so
// they are emitted in stored order.
const polygonWkt = (polygon) => `(${polygon.map(ring).join(', ')})`

/** Convert one GeoJSON geometry to WKT. Returns '' for null geometry. */
export function toWkt(geometry) {
  if (!geometry) return ''
  const g = geometry.coordinates
  switch (geometry.type) {
    case 'Point': return `POINT (${g[0]} ${g[1]})`
    case 'MultiPoint': return `MULTIPOINT ${ring(g)}`
    case 'LineString': return `LINESTRING ${ring(g)}`
    case 'MultiLineString': return `MULTILINESTRING (${g.map(ring).join(', ')})`
    case 'Polygon': return `POLYGON ${polygonWkt(g)}`
    case 'MultiPolygon': return `MULTIPOLYGON (${g.map(polygonWkt).join(', ')})`

    case 'GeometryCollection':
      return `GEOMETRYCOLLECTION (${(geometry.geometries || []).map(toWkt).join(', ')})`
    default: return ''
  }
}

/**
 * Douglas-Peucker tolerances used to build `public/data`, in degrees, and
 * roughly what they mean on the ground in India.
 */
const TOLERANCES = {
  states: { degrees: 0.01, about: '1.1 km' },
  districts: { degrees: 0.002, about: '220 m' },
  subdistricts: { degrees: 0.0005, about: '55 m' },
}

/** Trigger a browser download for `csv`. */
export function downloadCsv(filename, csv) {
  // The BOM makes Excel read the file as UTF-8; sub-district names in this
  // dataset include Latin-1 and Devanagari transliterations.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

const slug = (s) =>
  String(s || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'india'

/** Attribute-only export for one node's children, straight from the index. */
export function exportChildAttributes(node, kind) {
  if (!node) return
  const children = kind === 'state' ? node.districts : node.subdistricts
  if (!children?.length) return
  const scope = kind === 'state' ? 'districts' : 'subdistricts'
  const columns = kind === 'state'
    ? ['state_lgd', 'state_name', 'district_lgd', 'district_name']
    : ['state_lgd', 'state_name', 'district_lgd', 'district_name',
       'subdistrict_lgd', 'subdistrict_name', 'subdistrict_type']
  downloadCsv(
    `${slug(node.name)}_${scope}.csv`,
    toCsv(columns, children.map((c) => ({
      state_lgd: node.code,
      state_name: node.name,
      district_lgd: kind === 'state' ? c.code : node.code,
      district_name: kind === 'state' ? c.name : node.name,
      subdistrict_lgd: c.code,
      subdistrict_name: c.name,
      subdistrict_type: c.type,
    }))),
  )
}

/**
 * Attributes plus WKT for the features of one level, from a loaded GeoJSON.
 * `kind` picks the simplification tolerance recorded in the file.
 */
export function exportFeatures(geojson, kind, label) {
  if (!geojson?.features?.length) return
  const attrs = Object.keys(geojson.features[0].properties || {})
  const columns = [...attrs, 'geometry_wkt', 'wkt_simplified_deg', 'wkt_simplified_about']
  const tol = TOLERANCES[kind] || { degrees: '', about: '' }
  downloadCsv(
    `${slug(label)}_${kind}.csv`,
    toCsv(columns, geojson.features.map((f) => ({
      ...f.properties,
      geometry_wkt: toWkt(f.geometry),
      wkt_simplified_deg: tol.degrees,
      wkt_simplified_about: tol.about,
    }))),
  )
}
