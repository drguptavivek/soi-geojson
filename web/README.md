# India — Administrative Boundaries map

React app for browsing the Survey of India state / district / sub-district boundary GeoJSON
produced by `build_geojson.py`. Renders the same data in **either Leaflet or OpenLayers** — the
toggle is top-right — so you can compare the two engines on identical input.

## Run it

```sh
cd ~/workspace/soi-geojson/web
npm install                  # first time only
uv run ../build_web_data.py  # generates public/data from the full-resolution GeoJSON
npm run dev
```

`build_web_data.py` must be run before `npm run dev` — the app fetches
`public/data/index.json` on load and has nothing to show without it.

## Interaction

- **Tree** on the left: State > District > Sub-district, with connector rules. Clicking a node
  loads and frames that level.
- **Click on the map works too** — a state, district or sub-district polygon drills down through
  exactly the same reducer as the tree.
- **Hover** any polygon to see its name. Three checkboxes turn on permanent labels for states,
  districts and sub-districts independently.
- **Every polygon is categorically coloured** at each level: distinct hue per polygon, ancestors
  desaturate to grey, and the state in focus keeps a strong outline behind its own districts.
- **Selecting one sub-district frames the whole district**, not just that polygon, so its siblings
  stay visible for comparison.
- **Breadcrumb** shows the full path with every ancestor clickable, plus an explicit "up".
- **Filter** matches anywhere in the branch — typing a sub-district name still surfaces its
  district and state. The list is scoped to the selected state, so the branch in focus is what you
  see.

Districts with no sub-district geometry in the source (27 in Arunachal Pradesh, 12 in Meghalaya)
are shown but disabled, with the reason in the tooltip.

## Basemaps

Pick from the dropdown, top-right. Thirteen providers are declared in
`src/config/basemaps.js`; one needing an API key you have not supplied is simply not offered, so
the list never shows a layer that would 401.

Keys live in `web/.env` (git-ignored):

```sh
cp .env.example .env      # fill in VITE_STADIA_API_KEY / VITE_MAPBOX_TOKEN
```

Vite inlines `VITE_*` variables into the client bundle, so a key set there is visible to anyone
who loads the page. That is expected for these services — restrict the key by HTTP referrer in
the provider's dashboard, and never put a server-side secret there.

## Structure

```
src/
  state/
    selection.js    useSelection() — the India > State > District > Sub-district
                    state machine. Knows nothing about any map library.
    filters.js      pure tree filtering and counts over index.json
    layers.js       buildLayers()/buildLegend() — pure functions from
                    (level + data + options) to render-agnostic descriptors
  config/
    basemaps.js     provider registry + URL expansion for each engine
    palette.js      categorical hues (golden-angle spread)
  components/
    Sidebar.jsx         tree, breadcrumb, filter, CSV export — presentation only
    MapView.jsx         Leaflet renderer
    MapViewOL.jsx       OpenLayers renderer
    ErrorBoundary.jsx   keeps a panel failure from blanking the app
  lib/csv.js           CSV escaping, GeoJSON→WKT, blob download
  hooks/useGeoJson.js   fetch + keep-previous-value loading
```

Layer descriptors carry **intent** (`kind`, `categorical`, `style`, `labels`, `emphasis`, `focus`,
`onClick`, `nameKey`), never engine objects. Leaflet and OpenLayers each interpret the same
descriptor, and `buildLayers` can be asserted on without a browser. Style overrides are written in
Leaflet's vocabulary (`weight`, `fillOpacity`, `dashArray`); `MapViewOL` translates them.

OpenLayers is `React.lazy`, so the main bundle is ~118 kB gzipped and the ~95 kB OL chunk loads
only when someone actually switches to it.

## Data

`public/data/` is generated and git-ignored. It is a **simplified, display-only** copy:

| | Full resolution | Web copy |
|---|---|---|
| states.geojson | 35.4 MB | 0.5 MB |
| districts/ | 119 MB | 6.3 MB |
| subdistricts/ | 280 MB | 43.1 MB |
| index.json | — | 408 KB |
| **total** | **432 MB** | **49.9 MB** |

Simplification is Douglas-Peucker at a tolerance tuned to the zoom each level is drawn at
(≈1.1 km states, ≈220 m districts, ≈55 m sub-districts), then coordinates rounded to 5 decimals.

**Use the originals in `~/Downloads/soi_pan_india/geojson` for any analysis.** These files are
display-only and are not topologically faithful.

`index.json` holds the whole tree — 36 states, 780 coded districts, 6,639 sub-districts — as codes
and names with no geometry, so the tree is usable before any map data arrives.

### CSV export

Two ways out, both client-side — nothing is uploaded, the files are built in the page from data
it already holds.

**↓ CSV**, in the list header, exports whatever the map is showing at the current level. Because
the geometry for the current level is always loaded, this always includes a `geometry_wkt`
column, plus `wkt_simplified_deg` and `wkt_simplified_about` recording the Douglas-Peucker
tolerance those coordinates were generalised to. The file is named for its scope:
`india_states.csv`, `kerala_districts.csv`, `palakkad_subdistricts.csv`.

**↓** on a state or district row exports that node's children as attributes only — no geometry,
and no request, so any state or district can be exported without navigating to it first.

The WKT is display geometry, at the tolerance recorded in the file. It is fine for plotting and
joining, not for measurement. Use the originals in `~/Downloads/soi_pan_india/geojson` when
accuracy matters.

## Disputed boundary areas

The publisher ships cross-border placeholders named `DISPUTED (A & B)` with no LGD code — 4 state
polygons and 28 district polygons. They are slivers drawn over the real borders, so they
double-drew those boundaries and put the word `DISPUTED` on the map and in the tree.

`build_web_data.py` now drops them, so the data itself no longer carries them. Madhya Pradesh,
Gujarat, Rajasthan, Bihar, Jharkhand and West Bengal are all still present as their own features,
so the map shows them plainly. The state count is 36 — the real 28 states + 8 UTs; the
placeholders were inflating it to 40.

## Verified

Live dev server, both engines, no console errors: country → Kerala → Palakkad → Chittur, with the
tree, breadcrumb, label toggles, hover names, basemap switching and the error boundary all
exercised. `npm run build` clean.


CSV export exercised at all three levels and both export paths. Every file was captured from the
real download, then parsed back with GeoPandas: 36 states / 14 Kerala districts / 7 Palakkad
sub-districts, all geometries valid, all EPSG:4326, and Chittur's exported WKT compares
`.equals()` to the source geometry. Quoting round-trips the dataset's one awkward name
(`SADAR, SUNDARGARH`) through pandas. **No tests** — this is manual verification, and
`lib/csv.js` and `buildLayers()` are the pure functions worth pinning down first.