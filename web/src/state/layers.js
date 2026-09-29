/**
 * Layer description builder.
 *
 * A pure function from (level + data + options) to an array of layer
 * descriptors. It emits *intent* — kind, colours, labels, click handlers — and
 * never touches Leaflet or OpenLayers, so the same list drives either renderer
 * and can be asserted on without a browser.
 *
 *   { key, kind, data, categorical, style, labels, emphasis, focus, onClick }
 */

/** The property that carries a human-readable name, per layer kind. */
const NAME_KEY = {
  states: 'state_name',
  districts: 'district_name',
  subdistricts: 'subdistrict_name',
  unassigned: 'district_name',
}

const nFeatures = (gj) => (gj ? gj.features.length : 0)

export function buildLayers({
  level, states, districtLayer, subLayer,
  state, district, subdistrict,
  labels = {}, focus, handlers = {},
}) {
  const layers = []
  const on = (k) => handlers[k]

  if (level === 'country') {
    if (states) {
      layers.push({
        key: 'states', kind: 'states', data: states, categorical: true,
        style: { weight: 1.1, fillOpacity: 0.35 },
        labels: !!labels.states, onClick: on('state'),
      })
    }
    if (handlers.unassigned) {
      layers.push({ key: 'unassigned', kind: 'unassigned', data: handlers.unassigned })
    }
  } else if (level === 'state') {
    // Neighbouring states drop to grey; the state in focus keeps a strong
    // outline so it stays visible behind its own districts.
    if (states) {
      layers.push({
        key: 'states', kind: 'states', data: states,
        style: { weight: 0.5, fillOpacity: 0.04, color: '#94a3b8' },
        emphasis: { key: 'state_name', value: state?.name, color: '#0f172a', weight: 2.6, alpha: 0.1 },
        labels: !!labels.states,
      })
    }
    if (districtLayer) {
      layers.push({
        key: 'districts', kind: 'districts', data: districtLayer, categorical: true,
        style: { weight: 1.2, fillOpacity: 0.32 },
        labels: !!labels.districts, onClick: on('district'),
      })
    }
  } else {
    if (states) {
      layers.push({
        key: 'states', kind: 'states', data: states,
        style: { weight: 0.4, fillOpacity: 0.02, color: '#cbd5e1' },
      })
    }
    if (districtLayer) {
      layers.push({
        key: 'districts', kind: 'districts', data: districtLayer,
        style: { weight: 0.6, fillOpacity: 0.04, color: '#94a3b8' },
        emphasis: { key: 'district_name', value: district?.name, color: '#334155', weight: 1.8, alpha: 0.08 },
        labels: !!labels.districts,
      })
    }
    if (subLayer) {
      layers.push({
        key: 'subs', kind: 'subdistricts', data: subLayer, categorical: true,
        style: { weight: 1.2, fillOpacity: 0.38 },
        labels: !!labels.subdistricts, focus, onClick: on('subdistrict'),
      })
    }
  }
  return layers.map((l) => ({ nameKey: NAME_KEY[l.kind] ?? 'name', ...l }))
}

export function buildLegend({ level, states, districtLayer, subLayer, unassigned, state, district, subdistrict }) {
  const legend = []
  if (level === 'country') {
    if (states) legend.push({ label: 'States / UTs', color: 'rgba(37,99,235,.35)', count: nFeatures(states) })
    if (unassigned) legend.push({ label: 'Unassigned boundary areas', color: 'rgba(220,38,38,.35)', count: nFeatures(unassigned) })
  } else if (level === 'state') {
    if (districtLayer) legend.push({ label: `${state?.name} districts`, color: 'rgba(13,148,136,.35)', count: nFeatures(districtLayer) })
  } else if (subLayer) {
    legend.push({
      label: subdistrict ? `${subdistrict.name} (${district?.name})` : `${district?.name} sub-districts`,
      color: 'rgba(180,83,9,.35)',
      count: nFeatures(subLayer),
    })
  }
  return legend
}
