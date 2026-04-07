-- ML Data Collection Schema
-- Run this on your PostgreSQL database (with TimescaleDB already installed).
--
-- Step 1 (prerequisite): TimescaleDB extension must be installed on the server.
--   sudo apt install timescaledb-2-postgresql-15
--   sudo timescaledb-tune --quiet --yes
--   sudo systemctl restart postgresql
--
-- Then connect and run this file:
--   psql -U postgres -d ktmbdb -f schema.sql

-- ─── Enable TimescaleDB ───────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ─── Raw position log ─────────────────────────────────────────────────────────
-- One row per vehicle per poll cycle (every ~30s), only when vehicle_ts changes.
-- at_station_name / at_station_idx are derived via GPS proximity (Haversine 300m),
-- not from the unreliable GTFS currentStatus field.
CREATE TABLE IF NOT EXISTS vehicle_positions_log (
    recorded_at      TIMESTAMPTZ      NOT NULL,  -- when our collector recorded it
    vehicle_ts       TIMESTAMPTZ      NOT NULL,  -- timestamp from KTMB GTFS feed
    trip_id          TEXT,
    route_id         TEXT,
    vehicle_id       TEXT,
    vehicle_label    TEXT,
    latitude         DOUBLE PRECISION,
    longitude        DOUBLE PRECISION,
    bearing          DOUBLE PRECISION,
    speed_kmh        DOUBLE PRECISION,
    raw_status       INTEGER,                    -- GTFS currentStatus (unreliable)
    gtfs_stop_id     TEXT,                       -- stop_id from GTFS feed (unreliable)
    -- Derived by collector using haversine proximity (ported from TripTracker.tsx)
    at_station_name  TEXT,                       -- station name if within 300m, else NULL
    at_station_idx   INTEGER,                    -- index in route's station array
    route_label      TEXT,                       -- matched route label

    -- TimescaleDB requires the partition column (recorded_at) in unique constraints
    UNIQUE (recorded_at, vehicle_ts, vehicle_id)
);

-- Convert to hypertable — auto-partitions data by day for fast time-range queries
SELECT create_hypertable(
    'vehicle_positions_log',
    'recorded_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Query by trip (most common ML training access pattern)
CREATE INDEX IF NOT EXISTS idx_vpl_trip_id
    ON vehicle_positions_log (trip_id, recorded_at DESC);

-- Query station dwell events
CREATE INDEX IF NOT EXISTS idx_vpl_at_station
    ON vehicle_positions_log (at_station_name, recorded_at DESC)
    WHERE at_station_name IS NOT NULL;

-- Auto-drop raw data older than 6 months (keeps DB size manageable)
SELECT add_retention_policy(
    'vehicle_positions_log',
    INTERVAL '6 months',
    if_not_exists => TRUE
);

