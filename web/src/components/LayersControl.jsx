import { Fragment } from 'react'

/**
 * Layers control: base layer on top, overlays below.
 *
 * This is the same idea as Leaflet's L.control.layers(baseLayers, overlays),
 * written once here rather than per engine. Using each engine's native control
 * would give Leaflet and OpenLayers two different panels for one feature, and
 * the app's data layers are rebuilt whenever the selection changes -- an OL
 * LayerSwitcher tracks OL layer objects, which do not survive that. Both
 * engines consume the same render-agnostic descriptors, so the control reads
 * the same state they do.
 */

/** Overlay entries, keyed by the layer key buildLayers() emits. */
const OVERLAYS = [
  { key: 'outline', label: 'Country outline' },
  { key: 'states', label: 'States' },
  { key: 'districts', label: 'Districts' },
  { key: 'subs', label: 'Sub-districts' },
]

const LABEL_KEYS = ['states', 'districts', 'subdistricts']
const labelText = (k) =>
  k === 'states' ? 'States' : k === 'districts' ? 'Districts' : 'Sub-districts'

export default function LayersControl({
  basemaps, basemap, onBasemap,
  available, hidden, onToggleLayer,
  labels, onToggleLabel,
  open, onToggleOpen,
}) {
  return (
    <div className={`layers-control ${open ? 'open' : ''}`}>
      <button
        className="lc-toggle"
        onClick={onToggleOpen}
        aria-expanded={open}
        title="Base layer and overlays"
      >
        Layers
      </button>

      {open && (
        <div className="lc-body">
          <section>
            <h3>Base layer</h3>
            <ul>
              {basemaps.map((b, i) => (
                <Fragment key={b.id}>
                  {/* Providers are declared in runs, so a header is emitted
                      wherever the provider changes. */}
                  {b.group && b.group !== basemaps[i - 1]?.group && (
                    <li className="lc-group">{b.group}</li>
                  )}
                  <li>
                    <label>
                      <input
                        type="radio"
                        name="base-layer"
                        checked={basemap?.id === b.id}
                        onChange={() => onBasemap(b.id)}
                      />
                      <span>{b.name}</span>
                    </label>
                  </li>
                </Fragment>
              ))}
            </ul>
          </section>

          {available.length > 0 && (
            <section>
              <h3>Overlays</h3>
              <ul>
                {OVERLAYS.filter((o) => available.includes(o.key)).map((o) => (
                  <li key={o.key}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!hidden.has(o.key)}
                        onChange={() => onToggleLayer(o.key)}
                      />
                      <span>{o.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3>Labels</h3>
            <ul>
              {LABEL_KEYS.map((k) => (
                <li key={k}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!labels[k]}
                      onChange={() => onToggleLabel(k)}
                    />
                    <span>{labelText(k)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
