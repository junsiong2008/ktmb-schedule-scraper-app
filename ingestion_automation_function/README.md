# KTMB Timetable Data Ingestion

Scripts to populate a fresh PostgreSQL database with KTMB timetable and map data.

## Prerequisites

- Python 3.10+
- PostgreSQL database (local or remote)
- A `gtfs_data/` folder containing the KTM GTFS static feed (`stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`)
- Parsed timetable CSVs in `parsed_timetable/`
- Overpass route geometry at `../ktmb_api/ktmb_overpass_route/ktm.json`

Install Python dependencies:

```bash
pip install -r requirements.txt
```

## Configuration

### `ingestion_automation_function/.env`

Used by `ingest_csv.py` and `ingest_gtfs_stations.py`:

```
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname>
```

### `ktmb_api/.env`

Used by `ingest_overpass_shapes.py` (reads `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`):

```
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=<password>
DB_NAME=ktmbdb
```

## Step 1 — Create the schema

Run `schema.sql` against your database to create all tables and indexes:

```bash
psql -h <host> -U <user> -d <dbname> -f schema.sql
```

On a fresh database, the `migrate_add_gtfs_route_id.sql` file is **not needed** — those columns are already included in `schema.sql`. That file only exists for migrating an older DB that was created before the column was added.

## Step 2 — Ingest timetable CSVs

Ingests all parsed timetable CSVs from `parsed_timetable/` into `routes`, `schedules`, `trips`, and `stop_times`. Running against a directory will truncate all tables first.

```bash
python ingest_csv.py parsed_timetable/
```

To ingest a single file without truncating:

```bash
python ingest_csv.py parsed_timetable/ETS_Northbound_4Feb2026.csv
```

## Step 3 — Ingest GTFS station coordinates and route shapes

Reads the KTM GTFS static feed to:
- Add `latitude`/`longitude` to all `stations` rows (fuzzy name matching)
- Populate `route_shapes` with one deduplicated polyline per GTFS route

```bash
python ingest_gtfs_stations.py --gtfs-dir ../gtfs_data
```

The GTFS feed for Malaysian public transport can be downloaded from [api.data.gov.my](https://api.data.gov.my/gtfs-static/prasarana).

## Step 4 — Enrich route shapes with high-res Overpass geometry

Replaces the straight-line GTFS stop sequences for the main KTM lines with detailed track geometry sourced from OpenStreetMap via Overpass API (stored in `ktmb_api/ktmb_overpass_route/ktm.json`).

This step is optional — if skipped, the live map will draw straight lines between stations instead of following the actual track.

```bash
python ingest_overpass_shapes.py --json ../ktmb_api/ktmb_overpass_route/ktm.json
```

Routes currently mapped to Overpass geometry:

| shape_group | Route | Overpass name |
|---|---|---|
| 1 | Port Klang Line | Port Klang Line (northbound/southbound) |
| 2 | Seremban Line | Laluan Seremban |
| 3 | Butterworth–Padang Besar | Butterworth–Padang Besar (northbound/southbound) |
| 4 | Butterworth–Ipoh | Butterworth–Ipoh (northbound/southbound) |
| 8 | ETS | ETS Gold (Padang Besar - Gemas) |

Intercity routes (groups 5–7) fall back to straight lines — no Overpass mapping defined.

## Verification

```bash
python verify_ingestion.py
```
