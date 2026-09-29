# Session handoff

> Rewrite this whole file each session; never append. Keep under ~150 lines — prune, don't split.
> Only the session that owns commits edits it; subagents and parallel sessions report back instead.
> Re-check every fact in-session before writing it down; drop anything unverified. Move lasting
> decisions into the project docs (README, policy, architecture) so they survive pruning.

## Repository and run

The repo is `~/workspace/soi-geojson`. Both generated GeoJSON tiers are checked in:

- `geojson/`: full-resolution build output, about 434 MB, copied from the Survey of India source
  and kept for analysis.
- `web/public/data/`: simplified display copy, about 52 MB, used directly by the browser app.

The app runs without rebuilding data:

```sh
cd ~/workspace/soi-geojson/web
npm run dev
```

To refresh the data, `build_geojson.py` reads source shapefiles and the LGD workbook from
`~/Downloads/soi_pan_india/`, writes full-resolution GeoJSON to the repository's `geojson/`,
and keeps its XLSX/audit outputs under Downloads. Then run `uv run build_web_data.py` from the
repo root to refresh the checked-in browser copy. Source shapefiles/workbook are not in the repo.

## Verified web data and map behavior

- Browser copy has 36 states, 780 districts, and 6,639 sub-districts.
- Disputed placeholder features are filtered before web GeoJSON is written; checked all three
  layers and found no `DISPUTED` properties.
- Labels anchor at a point computed from the largest polygon part; verified in Leaflet and
  OpenLayers. The app starts with no basemap, and the layer control offers `None`.
- `npm run build` succeeds. `npm run lint` reports six warnings in Sidebar, useGeoJson, filters,
  and state/layers; none are in the label or basemap changes.
- CARTO raster URLs use `?key=`, the documented host, and Voyager's documented rastertiles paths.

## Source inputs and rebuild caveats

- Source shapefiles: `~/Downloads/soi_pan_india/State_District_Subdistrict_PAN INDIA/`.
- Official LGD workbook: `~/Downloads/soi_pan_india/All_Districtof_India_2026-08-10_14-15-33.xlsx`.
- `build_geojson.py` clears and recreates `geojson/` and the external XLSX output directory.
  Keep the clear step: output filenames embed district names, so renames otherwise leave stale files.
- The source RAR was previously verified with `lsar -t`; size alone does not prove a resumed download
  is intact.
- Licensing of the Survey of India source remains unverified; confirm terms before redistribution.
