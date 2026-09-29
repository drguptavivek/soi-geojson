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

/** The property that carries a human-readable name, per layer kind.
 *  `outline` is null: the country-border layer carries no label and is not
 *  clickable, it exists only to keep India on screen. */
const NAME_KEY = {
  states: 'state_name',
  districts: 'district_name',
  subdistricts: 'subdistrict_name',
  outline: null,
}

const nFeatures = (gj) => (gj ? gj.features.length : 0)

export function buildLayers({
  level, states, districtLayer, subLayer,
  state, district, subdistrict,
  labels = {}, focus, handlers = {},
}) {
  const layers = []
  const on = (k) => handlers[k]

  // The country outline is drawn at every level: a fixed, unfilled state
  // boundary layer sits underneath everything, so India never disappears from
  // the map no matter how far you drill in.
  if (states) {
    layers.push({
      key: 'outline', kind: 'outline', data: states, outlineOnly: true,
      style: { weight: 1.4, color: '#475569', fillOpacity: 0 },
    })
  }

  if (level === 'country') {
    if (states) {
      layers.push({
        key: 'states', kind: 'states', data: states, categorical: true,
        style: { weight: 1.1, fillOpacity: 0.35 },
        labels: !!labels.states, onClick: on('state'),
      })
    }
  } else if (level === 'state') {
    // Neighbouring states keep a visible outline but no fill; the state in
    // focus is emphasised so it reads behind its own districts.
    if (states) {
      layers.push({
        key: 'states', kind: 'states', data: states,
        style: { weight: 0.9, fillOpacity: 0.04, color: '#94a3b8' },
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
    // Sibling districts drop to near-invisible context, so the selected
    // district's sub-districts are the only thing competing for attention.
    if (districtLayer) {
      layers.push({
        key: 'districts', kind: 'districts', data: districtLayer,
        style: { weight: 0.35, fillOpacity: 0.015, color: '#cbd5e1' },
        emphasis: { key: 'district_name', value: district?.name, color: '#64748b', weight: 1.2, alpha: 0.05 },
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

export function buildLegend({ level, states, districtLayer, subLayer, state, district, subdistrict }) {
  const legend = []
  if (level === 'country') {
    if (states) legend.push({ label: 'States / UTs', color: 'rgba(37,99,235,.35)', count: nFeatures(states) })
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
