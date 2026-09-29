# Session handoff

> Rewrite this whole file each session; never append. Keep under ~150 lines — prune, don't split.
> Only the session that owns commits edits it; subagents and parallel sessions report back instead.
> Re-check every fact in-session before writing it down; drop anything unverified. Move lasting
> decisions into the project docs (README, policy, architecture) so they survive pruning.

## 1. Environment and how to run it

No git repo and no remote exist for this work — `~/workspace/soi-geojson` and
`~/Downloads/soi_pan_india` are plain directories. The only repo on the machine is the unrelated
`~/workspace/fundus_img_xtract`. **Commit/push steps of the handoff protocol do not apply here**;
do not initialise a repo without the owner asking.

```sh
cd ~/workspace/soi-geojson
uv run build_geojson.py        # ~40-60 s; no install step, uv bootstraps .venv
```

`uv run` creates `.venv` and installs from `pyproject.toml` on first use (verified from a deleted
`.venv`). `uv run -- python - <<'PY'` works for one-off inspection without a project script.

Rebuild clears `geojson/` and `xlsx/` before writing — **do not remove that**, output filenames
embed district names, so a rename leaves stale files behind (this bit us once: 7,862 features
instead of 7,515).

## 2. Inputs

| What | Where |
|---|---|
| Source shapefiles (19 files, 373 MB) | `~/Downloads/soi_pan_india/State_District_Subdistrict_PAN INDIA/` |
| Official LGD workbook | `~/Downloads/soi_pan_india/All_Districtof_India_2026-08-10_14-15-33.xlsx` |
| Build script | `~/workspace/soi-geojson/build_geojson.py` |
| Flaky-server downloader | `~/bin/resume-dl` |
| Outputs + README | `~/Downloads/soi_pan_india/` |

Source RAR: 202,524,438 bytes, SHA-256 `b8325e5d9dd0f04a6663d775363fe38cd2f23bd9dbae3fb7118b4e6e0ce0bcb7`.
`surveyofindia.gov.in` drops long transfers routinely; a full fetch took 5 attempts. A resumed
partial from a failed browser download produced a **full-size but corrupt** file, so always finish
with `lsar -t` — size alone does not prove integrity.

## 3. Verified state (re-checked 2026-09-29)

- 7,515 features written: 40 states, 808 districts (37 files), 6,667 sub-districts (741 files).
- 0 corruption markers and 0 non-ASCII characters remaining in any output property.
- XLSX: States 40, Districts 808, Sub-districts 6,667, Data quality 378 rows.
- Build reports 267 rule repairs, 86 LGD spellings adopted and 3 manual corrections; identical
  after a clean-venv rebuild. `HOWRAH`, `KAMJONG` and `GHUMARWIN` confirmed present in the output.
- All output geometry is valid and EPSG:4326.

## 4. Open decisions for the owner

1. **Licensing is unverified.** The RAR ships no licence/terms/credit file. A web search returned
   only noise. Must be confirmed with Survey of India before redistribution. README says so.
2. **Should sub-district names get an LGD source?** The supplied workbook is district-level only.
   A sub-district-level LGD file would let the same rule + LGD + corrections treatment apply one
   level down. Sub-district names currently rest on the rule alone.

**Closed 2026-09-29** — the three name questions were answered by the owner and are now in the
`CORRECTIONS` table in `build_geojson.py`, applied after the LGD step so they beat the workbook:
`HAORA`→`HOWRAH` (WB 341), `KAMJANG`→`KAMJONG` (Manipur 670, per kamjong.nic.in),
`GHURMWIN`→`GHUMARWIN` (Bilaspur, HP sub-division). Verified present in the output.

## 5. Approved work not yet started

None. Nothing has been queued with the owner.

## 6. Standing caveats (still true)

- The LGD workbook is a **different vintage** from the shapefiles and reuses the same district codes
  for different districts (WB `305 Bankura` vs `339`). **Never join on district code** — match on
  name only. A code join silently renames districts; this happened once already.
- The LGD workbook carries the **same vowel-loss defect** as the shapefiles (`<`→A, `\`→I, `#`→U),
  so the repair rule is applied to it before matching. It is not a clean reference.
- The LGD workbook predates the 2022 J&K reorganisation, so post-2022 districts are absent and keep
  their rule-repaired names.
- 42 districts have no sub-district geometry (27 Arunachal Pradesh, 15 Meghalaya) — the
  sub-district layer is genuinely incomplete there, not a build bug.
- 28 disputed districts and 28 disputed sub-districts are the **same 28 parcels in both layers**.
  Do not union the two layers; that double-counts them.
- 2 districts are coded `NOT AVAILABLE` (Mirpur, Muzaffarabad, J&K) and get `NA_*` filenames.
- `SUBDIS_LGD` 938 is used twice (duplicate HARRAIYA rows); 6148 and 3606 are each shared by two
  sub-districts in different states.
- Source shapefile codes are inconsistently zero-padded (`7` vs `07`, `31` vs `031`); the script
  normalises before every join. `SUBDIS_LGD` has no consistent width and is left verbatim.
- `District Boundary.shp` is PolygonZ but every Z is 0, so output is 2D.

## 7. Rule summary (full detail in the data README)

Corruption replaces a vowel with a stray ASCII character, in two equivalent sets:
`>`/`<`→`A`, `@`/`#`→`U`, `|`/`\`→`I`. Result is uppercased; **plain ASCII only, no diacritics**,
matching the dataset's own clean values. Where the LGD workbook lists the district, its spelling
wins. The build asserts no corruption marker survives and that repairs were made, so a future data
update with new corruption fails loudly instead of being silently half-fixed.
