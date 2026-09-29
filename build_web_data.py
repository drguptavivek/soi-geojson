#!/usr/bin/env python3
"""
Generate browser-sized copies of the GeoJSON outputs for the React map.

Reads the already-corrected files in ~/Downloads/soi_pan_india/geojson and writes
simplified, lower-precision copies to web/public/data, plus an index.json holding
the code/name metadata the filter UI needs (no geometry, so it loads instantly).

The full-resolution output is 435 MB and the state layer alone is 35 MB -- far too
heavy for a browser. Simplification is display-only: these files are for the map,
not for analysis. Use the originals in ~/Downloads/soi_pan_india/geojson for that.

    uv run build_web_data.py
"""
import json
import os
import shutil

import geopandas as gpd
import shapely

SRC = "/Users/vivekgupta/Downloads/soi_pan_india/geojson"
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "public", "data")

# Douglas-Peucker tolerance in degrees, tuned to the zoom each level is drawn at
# (~1.1 km, ~220 m, ~55 m respectively).
TOL = {"states": 0.010, "districts": 0.002, "subdistricts": 0.0005}
PRECISION = 5

EXT = ".geojson"


def stem_of(filename):
    """'01_JAMMU AND KASHMIR.geojson' -> '01_JAMMU AND KASHMIR'."""
    return filename[:-len(EXT)] if filename.endswith(EXT) else filename


def simplify(path, tol, out):
    gdf = drop_disputed(gpd.read_file(path))
    gdf["geometry"] = gdf.geometry.simplify(tol, preserve_topology=True)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    gdf.to_file(out, driver="GeoJSON", COORDINATE_PRECISION=PRECISION)
    return os.path.getsize(out), len(gdf)


# The publisher labels cross-border placeholders 'DISPUTED (A & B)' and gives
# them no LGD code. They are slivers laid over the real borders, so keeping
# them both double-draws those boundaries and puts the word DISPUTED on the
# map. The real A and B are already present as their own features, so dropping
# the placeholders leaves plain states.
DISPUTED_PREFIX = "DISPUTED"
NAME_COLS = ("state_name", "district_name", "subdistrict_name", "remarks")


def drop_disputed(gdf):
    mask = False
    for c in NAME_COLS:
        if c in gdf.columns:
            m = gdf[c].fillna("").astype(str).str.upper().str.startswith(DISPUTED_PREFIX)
            mask = m if mask is False else (mask | m)
    return gdf if mask is False else gdf[~mask]


def is_disputed(row):
    """True for the publisher's cross-border placeholders. Works on the raw
    property dict props() returns, mirroring drop_disputed() for GeoFrames."""
    return any(
        str(row.get(c) or "").upper().startswith(DISPUTED_PREFIX) for c in NAME_COLS
    )


def props(path):
    """Feature properties only -- used to build the filter index."""
    with open(path) as f:
        return [ft["properties"] for ft in json.load(f)["features"]]


def main():
    if os.path.isdir(DST):
        shutil.rmtree(DST)
    totals = {}

    # --- states + index ---
    p = f"{SRC}/states.geojson"
    n, k = simplify(p, TOL["states"], f"{DST}/states.geojson")
    totals["states"] = n
    # The source carries 4 disputed placeholders; simplify() has already dropped
    # them from the geometry, so drop them from the index rows too.
    state_rows = [r for r in props(p) if not is_disputed(r)]
    print(f"states.geojson      {len(state_rows):3} features  {n/1048576:6.1f} MB")

    # --- districts, one file per state ---
    dist_dir = f"{SRC}/districts"
    sub_dir = f"{SRC}/subdistricts"
    by_state = {}
    dn = dk = 0
    for fn in sorted(os.listdir(dist_dir)):
        if not fn.endswith(EXT):
            continue
        if fn.startswith("_"):
            # '_disputed.geojson' holds the 28 cross-border placeholders. They
            # belong to no state, so nothing in the tree can link to them.
            continue
        n, k = simplify(f"{dist_dir}/{fn}", TOL["districts"], f"{DST}/districts/{fn}")
        dn += n
        dk += k
    totals["districts"] = dn
    print(f"districts/          {dk:3} features  {dn/1048576:6.1f} MB")

    # --- sub-districts, one file per district ---
    # Names are captured here so the app's State > District > Sub-district tree
    # needs no extra request: the file name only encodes the district, not the
    # sub-districts inside it.
    sn = sk = 0
    sub_names = {}
    for state in sorted(os.listdir(sub_dir)):
        sdir = f"{sub_dir}/{state}"
        if not os.path.isdir(sdir):
            continue
        for fn in sorted(os.listdir(sdir)):
            if not fn.endswith(EXT):
                continue
            n, k = simplify(f"{sdir}/{fn}", TOL["subdistricts"],
                            f"{DST}/subdistricts/{state}/{fn}")
            sn += n
            sk += k
            sub_names[f"subdistricts/{state}/{fn}"] = [
                {"code": p.get("subdistrict_lgd", ""),
                 "name": p.get("subdistrict_name", ""),
                 "type": p.get("subdistrict_type", "")}
                for p in props(f"{DST}/subdistricts/{state}/{fn}")
            ]
    totals["subdistricts"] = sn
    print(f"subdistricts/       {sk:3} features  {sn/1048576:6.1f} MB")

    # --- index for the filter UI: codes and names, no geometry ---
    # Built from the 40 state polygons, so every state appears exactly once. Each
    # is linked to its districts/<CODE>_<SLUG>.geojson by the state code, and to
    # the matching subdistricts/<CODE>_<SLUG>/ directory. The 28 disputed
    # districts live in districts/_disputed.geojson and belong to no state.
    def districts_of(stem):
        sdir = f"{DST}/subdistricts/{stem}"
        by_code, by_slug = {}, {}
        if os.path.isdir(sdir):
            for f in sorted(os.listdir(sdir)):
                if not f.endswith(EXT):
                    continue
                fstem = stem_of(f)
                rel = f"subdistricts/{stem}/{f}"
                by_code.setdefault(fstem.split("_", 1)[0], []).append(rel)
                by_slug.setdefault(fstem.split("_", 1)[1].replace("_", " "), []).append(rel)
        path = f"{DST}/districts/{stem}.geojson"
        out = []
        for d in props(path) if os.path.exists(path) else []:
            key = d.get("district_lgd") or ""
            files = (by_code.get(key) or by_slug.get(d["district_name"]) or [])
            subs = sub_names.get(files[0], []) if files else []
            out.append({
                "code": key,
                "name": d["district_name"],
                "subdistrict_files": files,
                "subdistricts": subs,
            })
        return out

    # code -> district-file stem, ignoring the _disputed bucket
    by_state_code = {stem_of(f).split("_", 1)[0]: stem_of(f)
                     for f in sorted(os.listdir(f"{DST}/districts"))
                     if f.endswith(EXT) and not f.startswith("_")}

    # `props()` reads the source, which still carries the 4 disputed state
    # placeholders; simplify() has already dropped them from the geometry.
    state_rows = [r for r in state_rows if not is_disputed(r)]
    states = []
    for s in state_rows:
        stem = by_state_code.get(s["state_lgd"]) if s["state_lgd"] else None
        states.append({
            "code": s["state_lgd"],
            "name": s["state_name"],
            "file": f"districts/{stem}{EXT}" if stem else None,
            "districts": districts_of(stem) if stem else [],
        })
    states.sort(key=lambda s: (not s["code"], s["code"]))

    with open(f"{DST}/index.json", "w") as f:
        json.dump({"states": states, "crs": "EPSG:4326"}, f, separators=(",", ":"))
    print(f"index.json          {len(states):3} states, "
          f"{sum(len(s['districts']) for s in states)} districts, "
          f"{os.path.getsize(f'{DST}/index.json')/1024:.0f} KB")
    print(f"\ntotal {sum(totals.values())/1048576:.1f} MB "
          f"(from {sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(SRC) for f in fs)/1048576:.0f} MB)")


if __name__ == "__main__":
    main()
