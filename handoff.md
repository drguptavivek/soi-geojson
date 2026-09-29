# Session handoff

> Rewrite this whole file each session; never append. Keep under ~150 lines — prune, don't split.
> Only the session that owns commits edits it; subagents and parallel sessions report back instead.
> Re-check every fact in-session before writing it down; drop anything unverified. Move lasting
> decisions into the project docs (README, policy, architecture) so they survive pruning.

## Repository and data

The public repo is `https://github.com/drguptavivek/soi-geojson`, default branch `main`.
Both generated GeoJSON tiers are committed:

- `geojson/`: full-resolution output, about 434 MB.
- `web/public/data/`: simplified display copy, about 52 MB.

The map runs from a checkout without building data:

```sh
cd web
npm run dev
```

To rebuild, `build_geojson.py` reads the source shapefiles and LGD workbook from
`~/Downloads/soi_pan_india/`, writes full-resolution GeoJSON to the repository's `geojson/`,
and keeps XLSX/audit outputs under Downloads. Then run `uv run build_web_data.py` from the repo
root to refresh the browser copy. Source shapefiles and workbook are not in the repo.

## Verified map behavior

- Browser copy has 36 states, 780 districts, and 6,639 sub-districts.
- Disputed placeholder features are filtered before web GeoJSON is written; all three layers were
  checked and contain no `DISPUTED` properties.
- Labels use anchors computed from the largest polygon part. Verified in Leaflet and OpenLayers.
- The app starts with no basemap; the layer control offers `None`.
- CARTO raster URLs use `?key=`, the documented host, and Voyager's documented rastertile paths.
- `npm run build` succeeds. `npm run lint` reports six warnings in Sidebar, useGeoJson, filters,
  and state/layers; none are in the label or basemap changes.

## Licensing and source caveats

- Original code, scripts, and documentation are MIT-licensed. `LICENSE` explicitly excludes all
  GeoJSON datasets and third-party source data.
- Survey of India redistribution terms for the derived GeoJSON remain unconfirmed. Do not infer
  data reuse permission from the repo's public visibility or the code MIT license.
- Source shapefiles: `~/Downloads/soi_pan_india/State_District_Subdistrict_PAN INDIA/`.
- Official LGD workbook: `~/Downloads/soi_pan_india/All_Districtof_India_2026-08-10_14-15-33.xlsx`.
