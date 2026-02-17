-- Migration: Add station coordinates and route shapes
-- Run this against the live database before running ingest_gtfs_stations.py

-- Add lat/lon columns to stations
ALTER TABLE stations ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Create route_shapes table for pre-computed polyline data
CREATE TABLE IF NOT EXISTS route_shapes (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    station_id INTEGER REFERENCES stations(id),
    station_name VARCHAR(255),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    stop_sequence INTEGER NOT NULL,
    shape_dist_traveled DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_route_shapes_route_id ON route_shapes(route_id);
