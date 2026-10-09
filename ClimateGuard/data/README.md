# Official Pune Dengue CSV Import

No machine-readable Pune dengue case file is bundled. The API deliberately reports Pune cases as unavailable until a verified official publication is imported; it does not create, interpolate, or backfill case counts.

Use a downloadable dataset or documented publication from an authoritative government source, such as the [National Center for Vector Borne Diseases Control](https://ncvbdc.mohfw.gov.in/). No Pune machine-readable case series was verified during this integration. Save a manually reviewed official CSV as `ClimateGuard/data/pune_dengue_cases.csv`. Record its actual publication date and URL, and retain the original reporting period, geographic unit, status, and reported count. Do not turn Maharashtra-wide or annual totals into Pune or weekly records.

Required UTF-8 CSV header:

```csv
period_start,period_end,area,area_level,cases,source,source_url,published_at,status
```

Each row must contain:

- `period_start`, `period_end`: original reporting-period bounds in `YYYY-MM-DD`.
- `area`, `area_level`: original reported geography, for example Pune District and District or Pune Municipal Corporation and Municipal Corporation.
- `cases`: non-negative whole-number reported case count.
- `source`, `source_url`: publication name and direct official publication/dataset URL.
- `published_at`: publication date in `YYYY-MM-DD`.
- `status`: `reported`, `provisional`, `incomplete`, or `aggregated`, matching the source's caveat.

The endpoint validates the file and exposes only `Pune district` rows with `area_level=District` and `Pune Municipal Corporation` rows with `area_level=Municipal Corporation` or `City` (case-insensitive). Ambiguous `Pune` labels, Maharashtra-wide totals, and other geographic levels are not returned by the Pune endpoint. Keep one row per original reporting period and area; do not fill missing weeks or combine periods. After import, request `GET /api/dengue/pune` and verify the returned source, publication date, area level, dates, and status against the original publication.
