-- Migration: Add gtfs_route_id to routes table
-- This links each DB route (directional schedule) to the corresponding GTFS static route ID,
-- which is used to filter route_shapes when snapping a live train position to the correct line.

ALTER TABLE routes ADD COLUMN IF NOT EXISTS gtfs_route_id VARCHAR(50);

-- Seremban Line (Batu Caves <-> Pulau Sebang/Tampin)
UPDATE routes SET gtfs_route_id = 'KC05_KB18'
WHERE service_type = 'Komuter'
  AND (UPPER(name) LIKE '%BATU CAVES%' OR UPPER(name) LIKE '%PULAU SEBANG%');

-- Port Klang Line (Tanjung Malim <-> Pelabuhan Klang)
UPDATE routes SET gtfs_route_id = 'KA15_KD19'
WHERE service_type = 'Komuter'
  AND (UPPER(name) LIKE '%TANJUNG MALIM%' OR UPPER(name) LIKE '%PELABUHAN KLANG%');

-- ETS (Electric Train Service)
UPDATE routes SET gtfs_route_id = 'ETS'
WHERE service_type = 'ETS';

-- Intercity: Shuttle Tebrau (JB Sentral <-> Woodlands)
UPDATE routes SET gtfs_route_id = 'ST'
WHERE service_type = 'Intercity'
  AND (UPPER(name) LIKE '%TEBRAU%' OR UPPER(name) LIKE '%WOODLANDS%');

-- Intercity: Ekspres Rakyat Timuran
UPDATE routes SET gtfs_route_id = 'ERT'
WHERE service_type = 'Intercity'
  AND UPPER(name) LIKE '%RAKYAT%';

-- Intercity: Ekspres Selatan
UPDATE routes SET gtfs_route_id = 'ES'
WHERE service_type = 'Intercity'
  AND UPPER(name) LIKE '%SELATAN%';

-- Intercity: Shuttle (Tumpat <-> Gemas) — catch-all for remaining Intercity
UPDATE routes SET gtfs_route_id = 'SH'
WHERE service_type = 'Intercity'
  AND gtfs_route_id IS NULL;
