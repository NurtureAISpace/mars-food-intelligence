# Inspiration4 (I4) clinical blood panels — real data, NASA OSDR, Inspiration4

**This folder contains REAL astronaut data**, unlike the synthetic crew used elsewhere in
the Crew Health module. The files are unmodified copies of public data from the NASA Open Science Data
Repository (OSDR). They came from the Inspiration4 mission (SpaceX, Sept 2021, about 3 days in orbit, 4 civilian crew).

Download date: 2026-11-14. The file sizes matched the sizes in the OSDR file-listing API exactly.

| File | OSD study | Panel | Format |
|---|---|---|---|
| `LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv` | OSD-569 | Complete Blood Count (CBC) | long: one row per analyte × subject × timepoint |
| `LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv` | OSD-569 | CBC | wide: one row per sample |
| `LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv` | OSD-575 | Comprehensive Metabolic Panel (CMP) | long |
| `LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv` | OSD-575 | CMP | wide |

The analysis script (`backend/scripts/i4_baseline_demo.py`) reads only the long-format `*_SUBMITTED.csv` files.
The `_TRANSFORMED` copies are kept for reference. One known label issue: in the CBC TRANSFORMED file the
hemoglobin columns are named `..._percent`, but the SUBMITTED file gives hemoglobin in g/dL.

## Sources

- File listing API (used to discover the files):
  - https://osdr.nasa.gov/osdr/data/osd/files/569
  - https://osdr.nasa.gov/osdr/data/osd/files/575
- Download endpoint (it returns a 302 redirect to a short-lived signed S3 URL):
  - `https://osdr.nasa.gov/geode-py/ws/studies/OSD-569/download?source=datamanager&file=<file name>`
  - `https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=<file name>`
- Study pages:
  - https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
  - https://osdr.nasa.gov/bio/repo/data/studies/OSD-575

## Contents (verified by inspecting the files)

- Subjects: `C001` (M), `C002` (F), `C003` (F), `C004` (M). These are de-identified IDs.
- Timepoints: `L-92`, `L-44`, `L-3` (days before launch) and `R+1`, `R+45`, `R+82`, `R+194` (days after return).
- CBC: 553 rows. Columns are ANALYTE, VALUE, RANGE_MIN, RANGE_MAX, UNITS, TEST_TYPE, SUBJECT_ID, SEX, TEST_DATE. There are 23 analyte labels;
  3 of them are `(FEMALE)` variants that appear only for C003 at R+1.
- CMP: 531 rows. The columns are the same, except the timepoint column is named `timepoint`. There are 19 analyte labels. Some values are empty, mostly
  BUN/CREATININE RATIO and one total bilirubin value. eGFR has no upper reference limit.
- The reference ranges (RANGE_MIN / RANGE_MAX) are the ranges reported by the lab. They change between timepoints for some
  analytes of C003.

Please cite the OSDR studies (OSD-569, OSD-575) and the Inspiration4 / SOMA publications if you use these data.
