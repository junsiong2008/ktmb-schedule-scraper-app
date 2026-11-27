-- Migration: Add public_holidays table
-- Replaces the external my-cuti-api lookup. The API reads this table to decide
-- whether a date should use the Weekend timetable. Fill it with ingest_holidays.py.

CREATE TABLE IF NOT EXISTS public_holidays (
    holiday_date DATE NOT NULL,
    state VARCHAR(10) NOT NULL DEFAULT 'KUL',
    name VARCHAR(255) NOT NULL,
    PRIMARY KEY (holiday_date, state)
);
