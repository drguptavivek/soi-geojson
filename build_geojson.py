#!/usr/bin/env python3
"""
Build GeoJSON + XLSX from the Survey of India PAN INDIA boundary shapefiles.

  geojson/states.geojson                                    all 40 state/UT polygons
  geojson/districts/<STATE_LGD>_<STATE>.geojson             districts, one file per state
  geojson/subdistricts/<STATE_LGD>_<STATE>/<DIST_LGD>_<DIST>.geojson
  geojson/subdistricts/_unassigned/disputed_territories.geojson
  ~/Downloads/soi_pan_india/xlsx/India_Admin_Codes.xlsx

Source codes are inconsistently zero-padded (STATE_LGD '7' vs '07', DIST_LGD
'31' vs '031'), so codes are normalised before every join. Source display names
contain corruption (see the Data quality sheet) -- district names are recovered
from the district table by code where possible; nothing is invented.
"""
import os
import re
import json
import collections

import geopandas as gpd
import shapely

SOURCE_ROOT = "/Users/vivekgupta/Downloads/soi_pan_india"
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(SOURCE_ROOT, "State_District_Subdistrict_PAN INDIA")
GJ = os.path.join(PROJECT_ROOT, "geojson")
XL = os.path.join(SOURCE_ROOT, "xlsx")

# Corruption rule
# ---------------
# The upstream export replaced a vowel with a stray character. Two character
# sets appear, carrying the same rule:
#     '>' or '<'   ->  A
#     '@' or '#'   ->  U
#     '|' or '\'   ->  I
# e.g. ANANTN>G -> ANANTNAG, Belag<vi -> BELAGAVI, B\dar -> BIDAR, Mys#ru -> MYSURU.
# The dataset's own convention is plain uppercase ASCII, so that is what we
# restore -- we do not invent a diacritic transliteration.
CORRUPT_RE = re.compile(r"[>@|<\\#]")
SUBST = {">": "A", "<": "A", "@": "U", "#": "U", "|": "I", "\\": "I"}

# Names the rule and the LGD workbook both get wrong. Applied last, so they win
# over the workbook's spelling. Each one needs an authority, not a guess.
CORRECTIONS = {
    "HAORA":    "HOWRAH",      # West Bengal 341; the source lost two characters
    "KAMJANG":  "KAMJONG",     # Manipur 670; kamjong.nic.in
    "GHURMWIN": "GHUMARWIN",   # Bilaspur, Himachal, sub-division
}

CORRECTED = []   # (was, now)

NOT_AVAIL = "NOT AVAILABLE"
PRECISION = 6          # ~0.11 m in decimal degrees
CRS_OUT = "EPSG:4326"  # RFC 7946

REPAIRS = []   # (source_value, repaired_value)
ADOPTED = []   # (repaired_value, lgd_value)


def repair(value):
    """Apply the vowel-substitution rule. Clean values pass through untouched."""
    if not value or not CORRUPT_RE.search(value):
        return value
    fixed = " ".join("".join(SUBST.get(c, c) for c in tok)
                    for tok in value.split()).upper()
    REPAIRS.append((value, fixed))
    return fixed


# --- official LGD workbook, used as the authority for spelling ----------------
import glob as _glob
import openpyxl

LGD_FILES = sorted(_glob.glob(os.path.join(SOURCE_ROOT, "All_Districtof_India_*.xlsx")))
lgd_by_state_name, lgd_by_name = {}, {}

if LGD_FILES:
    _rows = list(openpyxl.load_workbook(LGD_FILES[0], read_only=True).active
                 .iter_rows(values_only=True))[2:]
    _states_of = {}
    for _r in _rows:
        if _r[1] is None or _r[3] is None:
            continue
        _st = repair(str(_r[2]).strip()).upper()      # the LGD file is corrupted too
        _dn = repair(str(_r[4]).strip()).upper()
        lgd_by_state_name[(_st, _dn)] = _dn
        _states_of.setdefault(_dn, set()).add(_st)
    # nationwide fallback, only where the name is unique across all states
    lgd_by_name = {k: k for k, v in _states_of.items() if len(v) == 1}


def authoritative(state_name, district_name, slgd, dlgd):
    """The LGD workbook's spelling for this district, or None if it has no entry.

    Matching is by NAME only, never by code: the workbook and the shapefiles are
    different vintages and reuse the same district codes for different districts
    (West Bengal 305 'Bankura' in the workbook vs 339 in the shapefile), so a
    code join silently renames districts.
    """
    if not LGD_FILES or not district_name:
        return None
    st = (state_name or "").upper()
    name = lgd_by_state_name.get((st, district_name.upper())) \
        or lgd_by_name.get(district_name.upper())
    return name if name and name != district_name else None


AUDIT = []
def audit(level, table, issue, detail):
    AUDIT.append((level, table, issue, detail))


def norm(series, width):
    """Zero-pad a code column, leaving blanks and NOT AVAILABLE untouched."""
    s = series.fillna("").astype(str).str.strip()
    return s.where(s.isin(["", NOT_AVAIL]), s.str.zfill(width))


def slug(s, maxlen=48):
    return re.sub(r"[^A-Za-z0-9]+", "_", s or "").strip("_")[:maxlen] or "UNNAMED"


# ------------------------------------------------------------------ load
st = gpd.read_file(f"{SRC}/State Boundary/State Boundary.shp")
di = gpd.read_file(f"{SRC}/District_Subdistrict_PAN INDIA/District Boundary.shp")
su = gpd.read_file(f"{SRC}/District_Subdistrict_PAN INDIA/Sub_district Boundary.shp")

for g in (st, di, su):
    g.geometry = shapely.force_2d(g.geometry)   # strip vestigial all-zero Z
    g.to_crs(CRS_OUT, inplace=True)
    g.set_geometry("geometry", inplace=True)

di["slgd"] = norm(di["STATE_LGD"], 2)
di["dlgd"] = norm(di["DIST_LGD"], 3)
su["slgd"] = norm(su["STATE_LGD"], 2)
su["dlgd"] = norm(su["DIST_LGD"], 3)

# ------------------------------------------- text fields (empty DBF -> NaN)

def astext(g, cols):
    """Empty DBF text fields come back as NaN; normalise to ''."""
    for c in cols:
        g[c] = g[c].fillna("").astype(str).str.strip()
    return g


astext(st, ["STATE", "Country"])
astext(di, ["STATE_UT", "STATE_LGD", "DISTRICT", "DIST_LGD", "REMARKS"])
astext(su, ["STATE_UT", "STATE_LGD", "DISTRICT", "DIST_LGD", "SUB_DIST",
            "SUBDIS_LGD", "SUBDIS_TYP", "REMARKS"])

# Repair the corrupted names, and record every change for the audit trail.
for g, cols in ((st, ["STATE"]), (di, ["DISTRICT"]), (su, ["DISTRICT", "SUB_DIST"])):
    for c in cols:
        g[c] = g[c].map(repair)

# Where the official LGD workbook knows the district, its spelling wins.
if LGD_FILES:
    def _lgd(r):
        name = authoritative(r.STATE_UT, r.DISTRICT, r.slgd, r.dlgd)
        if name and name != r.DISTRICT:
            ADOPTED.append((r.DISTRICT, name))
            return name
        return r.DISTRICT
    di["DISTRICT"] = di.apply(_lgd, axis=1)
    su["DISTRICT"] = su.apply(
        lambda r: authoritative(r.STATE_UT, r.DISTRICT, r.slgd, r.dlgd) or r.DISTRICT,
        axis=1)

# Manual corrections, applied last so they beat the LGD workbook's spelling.
for _g, _col in ((di, "DISTRICT"), (su, "DISTRICT"), (su, "SUB_DIST")):
    def _fix(v):
        new = CORRECTIONS.get(v)
        if new:
            CORRECTED.append((v, new))
            return new
        return v
    _g[_col] = _g[_col].map(_fix)

# Nothing may still carry a corruption marker after repair, and every repair
# must be in the audit trail -- a data update with new corruption stops here.
leftover = sorted({v for v in (di["DISTRICT"].tolist() + su["DISTRICT"].tolist()
                                + su["SUB_DIST"].tolist() + st["STATE"].tolist())
                    if CORRUPT_RE.search(v)})
assert not leftover, f"corruption still present after repair: {leftover}"
assert len(REPAIRS), "no repairs recorded -- the corruption pattern may have changed"

n_fix = len(set(REPAIRS))
audit("ok", "names", f"{n_fix} corrupted names repaired by rule",
      "the source lost a vowel in each, leaving one of '>' '<' '@' '#' '|' '\\'. "
      "Rule: '>'/'<'->A, '@'/'#'->U, '|'/'\\'->I, giving the dataset's own plain "
      "uppercase ASCII (ANANTN>G -> ANANTNAG, Belag<vi -> BELAGAVI). Every "
      "before/after pair is on the Data quality sheet.")
if LGD_FILES:
    n_adopt = len(set(ADOPTED))
    audit("ok", "names", f"{n_adopt} district spellings taken from the LGD workbook",
          f"where the workbook lists the district, its spelling wins over the "
          f"repaired one. Matched on state+name, then on a nationwide name that is "
          f"unique across all states -- never on district code, because the two "
          f"sources are different vintages. Source: {os.path.basename(LGD_FILES[0])}")
if CORRECTED:
    audit("ok", "names", f"{len(set(CORRECTED))} manual corrections applied",
          "names the rule and the workbook both get wrong, confirmed by the owner: "
          + "; ".join(f"{a} -> {b}" for a, b in sorted(set(CORRECTED))))

# ------------------------------------------ state codes (absent from the .shp)
# State Boundary.shp has no LGD code column; derive it by matching the STATE
# name against the STATE_UT values used by the district table.
name2lgd = {}
for r in di.itertuples():
    if r.STATE_UT and r.slgd:
        name2lgd.setdefault(r.STATE_UT, r.slgd)

ALIASES = {"ANDAMAN & NICOBAR": "ANDAMAN AND NICOBAR ISLANDS"}

st["slgd"] = st["STATE"].map(
    lambda n: name2lgd.get(n) or name2lgd.get(ALIASES.get(n, ""), ""))
st["codesrc"] = st["STATE"].map(
    lambda n: "exact" if n in name2lgd
    else ("alias" if ALIASES.get(n) in name2lgd else "none"))

lgd2name = {v: k for k, v in name2lgd.items()}

# --------------------------- district names (district table is authoritative)
dist_name = {}
for r in di.itertuples():
    if r.slgd and r.dlgd and r.dlgd != NOT_AVAIL:
        dist_name.setdefault((r.slgd, r.dlgd), r.DISTRICT)

n_recovered = sum(
    1 for r in su.itertuples()
    if (r.slgd, r.dlgd) in dist_name and r.DISTRICT != dist_name[(r.slgd, r.dlgd)])
audit("ok", "Sub_district", "district names recovered by code",
      f"{n_recovered} sub-district rows carried a corrupted DISTRICT name; the "
      f"clean name was taken from District Boundary.dbf via (STATE_LGD, DIST_LGD)")


def sub_props(r):
    """Output properties for one sub-district row."""
    clean = dist_name.get((r.slgd, r.dlgd), "")
    dname, dsrc = (clean, "district_table") if clean else (r.DISTRICT, "subdist_table")
    return {
        "OBJECTID": int(r.OBJECTID),
        "state_lgd": r.slgd,
        "state_name": r.STATE_UT or lgd2name.get(r.slgd, ""),
        "district_lgd": r.dlgd,
        "district_name": dname,
        "district_name_source": dsrc,
        "subdistrict_lgd": r.SUBDIS_LGD,
        "subdistrict_name": r.SUB_DIST,
        "subdistrict_type": r.SUBDIS_TYP,
        "name_corrupted": bool(CORRUPT_RE.search(r.SUB_DIST)
                               or CORRUPT_RE.search(r.DISTRICT)),
        "remarks": r.REMARKS,
    }


def write_gj(gdf, path, name):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    gdf.to_file(path, driver="GeoJSON", COORDINATE_PRECISION=PRECISION)
    with open(path) as f:
        fc = json.load(f)
    fc = {"type": "FeatureCollection", "name": name,
          "crs_note": "RFC 7946 WGS84 lon/lat (EPSG:4326); source CRS was LCC_WGS84",
          "features": fc["features"]}
    with open(path, "w") as f:
        json.dump(fc, f, separators=(",", ":"), ensure_ascii=False)
    return path


# Output file names embed district names, so a rename (e.g. after a name repair)
# would leave the previous run's files behind. Clear the tree first.
import shutil
for d in (GJ, XL):
    if os.path.isdir(d):
        shutil.rmtree(d)

written = []

# ---------------------------------------------------------------- 1. STATES
st["name_corrupted"] = st["STATE"].map(lambda n: bool(CORRUPT_RE.search(n)))
s_st = st.rename(columns={"STATE": "state_name", "Country": "country"})[
    ["OBJECTID", "state_name", "slgd", "country", "name_corrupted",
     "codesrc", "geometry"]].rename(columns={"slgd": "state_lgd",
                                            "codesrc": "lgd_code_source"})
written.append(write_gj(s_st, f"{GJ}/states.geojson", "India - State/UT boundaries"))

# ------------------------------------------------------------- 2. DISTRICTS
by_state = collections.defaultdict(list)
for r in di.itertuples():
    by_state[r.slgd if r.slgd else "__DISPUTED__"].append(r)

for key, rows in sorted(by_state.items()):
    if key == "__DISPUTED__":
        folder, label = "_disputed", "Disputed territories"
    else:
        folder = f"{key}_{slug(lgd2name.get(key, 'STATE'))}"
        label = lgd2name.get(key, f"STATE {key}")
    part = gpd.GeoDataFrame(
        [{"OBJECTID": int(r.OBJECTID), "state_lgd": r.slgd,
          "state_name": r.STATE_UT, "district_lgd": r.dlgd,
          "district_name": r.DISTRICT,
          "name_corrupted": bool(CORRUPT_RE.search(r.DISTRICT)),
          "remarks": r.REMARKS, "geometry": r.geometry} for r in rows],
        crs=CRS_OUT)
    written.append(write_gj(part, f"{GJ}/districts/{folder}.geojson",
                            f"{label} - District boundaries"))

# ---------------------------------------------------------- 3. SUB-DISTRICTS
by_dist = collections.defaultdict(list)
unassigned = []
for r in su.itertuples():
    p = sub_props(r)
    if r.slgd:
        by_dist[(r.slgd, r.dlgd, p["district_name"])].append((r, p))
    else:
        unassigned.append((r, p))

n_dir = 0
for (slgd, dlgd, dname), items in sorted(by_dist.items()):
    sname = lgd2name.get(slgd, f"STATE_{slgd}")
    sdir = f"{slgd}_{slug(sname)}"
    dpart = (f"{dlgd}_{slug(dname)}" if dlgd and dlgd != NOT_AVAIL
             else f"NA_{slug(dname)}")
    part = gpd.GeoDataFrame([{**p, "geometry": r.geometry} for r, p in items], crs=CRS_OUT)
    written.append(write_gj(part, f"{GJ}/subdistricts/{sdir}/{dpart}.geojson",
                            f"{dname}, {sname} - Sub-district boundaries"))
    n_dir += 1

if unassigned:
    part = gpd.GeoDataFrame(
        [{**p, "district_name": r.DISTRICT, "geometry": r.geometry}
         for r, p in unassigned], crs=CRS_OUT)
    written.append(write_gj(
        part, f"{GJ}/subdistricts/_unassigned/disputed_territories.geojson",
        "Disputed territories (no state or district code)"))

# ------------------------------------------------------------------ 4. AUDIT
audit("warn", "District Boundary", "28 disputed districts carry no STATE_LGD",
      "written to geojson/districts/_disputed.geojson; these are cross-border claims")
audit("warn", "Sub_district Boundary", "28 disputed sub-districts carry no codes",
      "written to geojson/subdistricts/_unassigned/disputed_territories.geojson")
audit("warn", "Sub_district Boundary", "52 named sub-districts carry no SUBDIS_LGD",
      "48 Haryana TEHSILs, 3 Jammu & Kashmir, 1 Delhi -- name present, code blank")
audit("warn", "Sub_district Boundary", "DHULE code conflict in Maharashtra",
      "District table says 498, Sub_district table says 598 -- a genuine source "
      "discrepancy, not a padding artefact")
audit("warn", "Sub_district Boundary", "SUBDIS_LGD 938 used twice",
      "HARRAIYA (Basti, Uttar Pradesh) appears as two rows with identical attributes")
audit("warn", "Sub_district Boundary", "SUBDIS_LGD 6148 and 3606 each used twice",
      "each is shared by two different sub-districts in different states")
audit("warn", "coverage", "42 districts have no sub-district geometry",
      "27 in Arunachal Pradesh and 15 in Meghalaya -- the sub-district layer is "
      "incomplete for these states")
audit("info", "geometry", "Z dimension dropped",
      "District Boundary.shp is a PolygonZ shapefile but every Z value is 0, so "
      "output is 2D")
audit("info", "CRS", f"reprojected to {CRS_OUT}",
      "source was LCC_WGS84 (Lambert Conformal Conic, false easting/northing "
      "4,000,000 m)")

with open(os.path.join(SOURCE_ROOT, "data_quality.json"), "w") as f:
    json.dump({"audit": AUDIT,
               "counts": {"states": len(st), "districts": len(di),
                          "subdistricts": len(su),
                          "district_files": len(by_state),
                          "subdistrict_files": n_dir,
                          "geojson_files": len(written)}}, f, indent=2)

print(f"states      : {len(st):5} features -> geojson/states.geojson")
print(f"districts   : {len(di):5} features -> {len(by_state)} files")
print(f"subdistricts: {len(su):5} features -> {n_dir} files (+{len(unassigned)} unassigned)")
print(f"geojson files written: {len(written)}")


# ==================================================================== 5. XLSX
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

wb = Workbook()
wb.remove(wb.active)
HDR = Font(bold=True, color="FFFFFF")
FILL = PatternFill("solid", fgColor="2F5597")


def sheet(title, headers, rows, text_cols=(), widths=None):
    """Codes are written as text so Excel keeps leading zeros ('01' -> 1)."""
    ws = wb.create_sheet(title)
    ws.append(headers)
    for c in ws[1]:
        c.font, c.fill = HDR, FILL
        c.alignment = Alignment(vertical="center")
    for r in rows:
        ws.append(list(r))
    for ci in text_cols:
        for (c,) in ws.iter_rows(min_row=2, min_col=ci, max_col=ci):
            c.number_format = "@"
            c.alignment = Alignment(horizontal="left")
    for i, h in enumerate(headers, 1):
        w = (widths or {}).get(h, max(12, min(40, len(h) + 4)))
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    return ws


# --- States: code + name ---
sheet("States", ["state_lgd", "state_name", "country", "name_corrupted",
                "lgd_code_source", "objectid"],
      ([r.slgd, r.STATE, r.Country,
        "yes" if CORRUPT_RE.search(r.STATE) else "", r.codesrc, int(r.OBJECTID)]
       for r in st.itertuples()),
      text_cols=(1,), widths={"state_name": 46})

# --- Districts: code + name, with parent state ---
sheet("Districts", ["state_lgd", "state_name", "district_lgd", "district_name",
                    "name_corrupted", "remarks", "objectid"],
      ([r.slgd, r.STATE_UT, r.dlgd, r.DISTRICT,
        "yes" if CORRUPT_RE.search(r.DISTRICT) else "", r.REMARKS, int(r.OBJECTID)]
       for r in di.itertuples()),
      text_cols=(1, 3), widths={"district_name": 34, "remarks": 38})

# --- Sub-districts: code + name, with parent state and district ---
sheet("Sub-districts", ["state_lgd", "state_name", "district_lgd", "district_name",
                        "subdistrict_lgd", "subdistrict_name", "subdistrict_type",
                        "name_corrupted", "remarks", "objectid"],
      ([p["state_lgd"], p["state_name"], p["district_lgd"], p["district_name"],
         p["subdistrict_lgd"], p["subdistrict_name"], p["subdistrict_type"],
         "yes" if p["name_corrupted"] else "", p["remarks"], p["OBJECTID"]]
       for p in (sub_props(r) for r in su.itertuples())),
      text_cols=(1, 3, 5), widths={"district_name": 30, "subdistrict_name": 30,
                                   "remarks": 30})

# --- Data quality ---
ws = wb.create_sheet("Data quality")
ws.append(["severity", "table", "issue", "detail"])
for c in ws[1]:
    c.font, c.fill = HDR, FILL
for a in AUDIT:
    ws.append(list(a))
ws.append([])
ws.append(["NAME REPAIRS BY RULE -- '>' '<' -> A, '@' '#' -> U, '|' '\\' -> I"])
ws.cell(row=ws.max_row, column=1).font = Font(bold=True)
ws.append(["source_value", "repaired_value"])
for ci in (1, 2):
    c = ws.cell(row=ws.max_row, column=ci)
    c.font, c.fill = HDR, FILL
for orig, fixed in sorted(set(REPAIRS)):
    ws.append([orig, fixed])
ws.append([])
ws.append(["SPELLINGS TAKEN FROM THE LGD WORKBOOK -- repaired name, official spelling"])
ws.cell(row=ws.max_row, column=1).font = Font(bold=True)
ws.append(["repaired_value", "lgd_value"])
for ci in (1, 2):
    c = ws.cell(row=ws.max_row, column=ci)
    c.font, c.fill = HDR, FILL
for was, now in sorted(set(ADOPTED)):
    ws.append([was, now])
ws.append([])
ws.append(["MANUAL CORRECTIONS -- rule and LGD workbook both wrong, owner-confirmed"])
ws.cell(row=ws.max_row, column=1).font = Font(bold=True)
ws.append(["value", "corrected_value"])
for ci in (1, 2):
    c = ws.cell(row=ws.max_row, column=ci)
    c.font, c.fill = HDR, FILL
for was, now in sorted(set(CORRECTED)):
    ws.append([was, now])
for col, w in (("A", 30), ("B", 30), ("C", 60), ("D", 95)):
    ws.column_dimensions[col].width = w
ws.freeze_panes = "A2"

os.makedirs(XL, exist_ok=True)
wb.save(f"{XL}/India_Admin_Codes.xlsx")
print(f"xlsx       : 4 sheets, {len(set(REPAIRS))} rule repairs, "
      f"{len(set(ADOPTED))} LGD spellings adopted")
