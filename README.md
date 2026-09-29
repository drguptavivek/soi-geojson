# India Administrative Boundaries — derived GeoJSON and map

This repository contains a processing pipeline and browser map for state, district, and sub-district boundaries in India. The data here are **processed derivatives** of Survey of India boundary data; they are not an official Government of India or Survey of India product, an official boundary declaration, or an endorsement by either organization.

The processing repairs selected source-name corruption and normalizes the attributes. The browser copy is simplified for display and omits disputed placeholder features. For authoritative boundaries, consult Survey of India and the appropriate government authority; do not use these files as a legal or administrative source.

## Data

| Path | Contents |
|---|---|
| `geojson/` | Full-resolution generated GeoJSON, including source disputed placeholders, for analysis |
| `web/public/data/` | Simplified browser GeoJSON; disputed placeholders are excluded |

Both generated GeoJSON tiers are committed, so the map runs from a checkout without a data build.

## Run the map

```sh
cd web
npm install       # first time only
npm run dev
```

See [`web/README.md`](web/README.md) for map controls, basemaps, and details.

## Rebuild data

The original source shapefiles and LGD workbook are not included. `build_geojson.py` expects them under `~/Downloads/soi_pan_india/` and writes the full-resolution GeoJSON into `geojson/`:

```sh
uv run build_geojson.py
uv run build_web_data.py
```

The second command regenerates the simplified browser copy from the repository's `geojson/` directory. The workbook and audit report are written to the source-data directory.

## Provenance and licensing

The generated files are derived from Survey of India boundary data, with repository-side processing and corrections. The terms allowing redistribution of the source-derived data have **not been confirmed**; the source archive provided for this project contained no license statement. Public availability of this repository does not establish permission to reuse or redistribute the data. Confirm applicable Survey of India terms before relying on or redistributing it.

This repository does not currently include a license for its code or data. No third-party reuse license should be inferred from its public visibility.
