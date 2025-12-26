-- Database Schema for KTMB Timetable Data

-- 1. Routes (e.g., Batu Caves - Pulau Sebang)
CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    service_type VARCHAR(50) NOT NULL, -- e.g., 'Komuter', 'ETS', 'Intercity'
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Stations (e.g., KL Sentral, Batu Caves)
CREATE TABLE IF NOT EXISTS stations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    code VARCHAR(50), -- Optional station code
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Schedules (Represents a specific PDF timetable validity period)
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    valid_from DATE NOT NULL,
    valid_to DATE, -- Can be NULL if indefinite
    day_type VARCHAR(50) NOT NULL, -- 'Weekday', 'Weekend', 'Public Holiday'
    source_file VARCHAR(255) NOT NULL, -- Name of the PDF file
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Trips (A specific train journey, e.g., Train 2207)
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    train_number VARCHAR(50) NOT NULL,
    direction VARCHAR(50), -- 'North', 'South', etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Stop Times (Arrival and departure at specific stations for a trip)
CREATE TABLE IF NOT EXISTS stop_times (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    station_id INTEGER REFERENCES stations(id) ON DELETE CASCADE,
    arrival_time TIME,
    departure_time TIME,
    stop_sequence INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stop_times_station_id ON stop_times(station_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_trip_id ON stop_times(trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_schedule_id ON trips(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedules_route_id ON schedules(route_id);
