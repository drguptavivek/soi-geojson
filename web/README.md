# India — Administrative Boundaries map

React app for browsing the Survey of India state / district / sub-district boundary GeoJSON
produced by `build_geojson.py`. Renders the same data in **either Leaflet or OpenLayers** — the
toggle is top-right — so you can compare the two engines on identical input.

## Run it

```sh
cd ~/workspace/soi-geojson/web
npm install          # first time only
uv run ../build_web_data.py    # generates public/data from the full-resolution GeoJSON
npm run dev
```

`build_web_data.py` must be run before `npm run dev` — the app fetches `public/data/index.json`
on load and has nothing to show without it.

## What it does

- **Filter** states and districts by typing; the box is scoped to the level you are viewing and
  clears when the level changes.
- **Drill down**: India → a state → a district, with breadcrumb navigation that jumps straight to
  a level rather than stepping back one step at a time.
- **Disputed districts**: the 28 cross-border parcels, drawn as dashed red outlines, on request.
- Districts with no sub-district geometry in the source (27 in Arunachal Pradesh, 12 in Meghalaya)
  are shown but disabled, with the reason in the tooltip.
- The viewport frames the most specific layer loaded.

## Data

`public/data/` is generated and git-ignored. It is a **simplified, display-only** copy:

| | Full resolution | Web copy |
|---|---|---|
| states.geojson | 35.4 MB | 0.5 MB |
| districts/ | 119 MB | 6.3 MB |
| subdistricts/ | 280 MB | 43.1 MB |
| **total** | **432 MB** | **49.9 MB** |

Simplification is Douglas-Peucker at a tolerance tuned to the zoom each level is drawn at
(≈1.1 km states, ≈220 m districts, ≈55 m sub-districts), then coordinates rounded to 5 decimals.

**Use the originals in `~/Downloads/soi_pan_india/geojson` for any analysis.** These files are
display-only and are not topologically faithful.

`index.json` holds the codes and names the filter UI needs, with no geometry, so it loads in one
small request (83 KB) and the lists are usable before any map data arrives.

## Layout

```
src/
  App.jsx                    level/state machine, layer assembly, engine switch
  components/
    Sidebar.jsx              filter, breadcrumbs, lists
    MapView.jsx              Leaflet (react-leaflet)
    MapViewOL.jsx            OpenLayers (ol)
  hooks/useGeoJson.js        fetch + keep-previous-value loading
  styles.css
```

Both map components take the same `layers` prop — an array of
`{ key, kind, data, style }` — and the same palette, so switching engines changes nothing but the
renderer. Style overrides are written in Leaflet's vocabulary (`weight`, `fillOpacity`,
`dashArray`); `MapViewOL` translates them to OpenLayers' `width` / alpha / `lineDash`.

OpenLayers is loaded with `React.lazy`, so the main bundle is 116 kB gzipped and the 95 kB OL
chunk is only fetched when someone actually switches to it.

## Verified

Against a live dev server, both engines, no console errors:

- 40 state polygons at country level; legend and feature counts match the source
- Kerala → 14 districts → Palakkad → 7 sub-districts, framing the selection at each step
- Breadcrumb jumps India → state → district directly
- 28 disputed districts render on toggle
- `npm run build` clean; `npm run lint` reports 2 warnings, both `set-state-in-effect` for
  deliberate state resets (filter on level change, data reset on path change)
