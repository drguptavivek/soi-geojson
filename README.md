# India Administrative Boundaries — derived GeoJSON and map

This repository contains a processing pipeline and browser map for state, district, and sub-district boundaries in India. The data here are **processed derivatives** of Survey of India boundary data; they are not an official Government of India or Survey of India product, an official boundary declaration, or an endorsement by either organization.

The processing repairs selected source-name corruption and normalizes the attributes. The browser copy is simplified for display and omits disputed placeholder features. For authoritative boundaries, consult Survey of India and the appropriate government authority; do not use these files as a legal or administrative source.

**Live map:** <https://drguptavivek.github.io/soi-geojson/>


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

## Licensing

The repository's original source code, build scripts, and documentation are licensed under the MIT
License; see [`LICENSE`](LICENSE). This license explicitly excludes the generated GeoJSON in
`geojson/` and `web/public/data/`, and all third-party source data.

The GeoJSON files are processed derivatives of Survey of India boundary data. Redistribution terms
for that source-derived data have **not been confirmed**; the source archive contained no license
statement. Public availability does not establish permission to reuse or redistribute the data.
Confirm applicable Survey of India terms before relying on or redistributing it.
