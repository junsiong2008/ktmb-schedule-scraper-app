'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

// ─── DB connection ────────────────────────────────────────────────────────────
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

const GTFS_URL = process.env.GTFS_URL || 'https://api.data.gov.my/gtfs-realtime/vehicle-position/ktmb';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '30000');

// ─── Ported from TripTracker.tsx line 25 ─────────────────────────────────────
const STATION_SNAP_DISTANCE_KM = 0.3; // 300m threshold to snap train to a station

// ─── Ported from TripTracker.tsx lines 13-23 ─────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Ported from TripTracker.tsx lines 28-87 ─────────────────────────────────
// Finds which route the train is on and whether it is within 300m of a station.
// Returns null if the train cannot be matched to any known route within 15km.
// routeShapes: [{ label: string, stations: [{ name, lat, lon }] }]
function findTrainPosition(trainLat, trainLon, routeShapes) {
    let bestRoute = null;
    let bestSegment = 0;
    let bestFraction = 0;
    let bestDist = Infinity;

    for (const route of routeShapes) {
        const stations = route.stations;
        if (stations.length < 2) continue;

        for (let i = 0; i < stations.length - 1; i++) {
            const A = stations[i];
            const B = stations[i + 1];

            const dA = haversine(trainLat, trainLon, A.lat, A.lon);
            const dB = haversine(trainLat, trainLon, B.lat, B.lon);
            const dAB = haversine(A.lat, A.lon, B.lat, B.lon);

            let fraction = 0;
            if (dAB > 0.01) {
                fraction = Math.max(0, Math.min(1,
                    (dA * dA - dB * dB + dAB * dAB) / (2 * dAB * dAB)
                ));
            }

            const projLat = A.lat + fraction * (B.lat - A.lat);
            const projLon = A.lon + fraction * (B.lon - A.lon);
            const distToSegment = haversine(trainLat, trainLon, projLat, projLon);

            if (distToSegment < bestDist) {
                bestDist = distToSegment;
                bestRoute = route;
                bestSegment = i;
                bestFraction = fraction;
            }
        }
    }

    if (bestRoute && bestDist < 15) {
        let atStationIdx = null;
        let atStationName = null;
        for (let i = 0; i < bestRoute.stations.length; i++) {
            const s = bestRoute.stations[i];
            if (haversine(trainLat, trainLon, s.lat, s.lon) < STATION_SNAP_DISTANCE_KM) {
                atStationIdx = i;
                atStationName = s.name;
                break;
            }
        }
        return {
            routeLabel: bestRoute.label,
            segmentIndex: bestSegment,
            fraction: bestFraction,
            atStationIdx,
            atStationName,
        };
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────

// Handles protobuf Long objects returned by gtfs-realtime-bindings
function getTimestamp(ts) {
    if (!ts) return Math.floor(Date.now() / 1000);
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'object') {
        if (typeof ts.toNumber === 'function') return ts.toNumber();
        if (ts.low !== undefined) return ts.low;
    }
    if (typeof ts === 'string') {
        const parsed = parseInt(ts, 10);
        if (!isNaN(parsed)) return parsed;
    }
    return Math.floor(Date.now() / 1000);
}

// Load route shapes directly from DB — same table that getRouteShapes() serves
async function loadRouteShapes() {
    const result = await pool.query(`
        SELECT shape_group, route_label, station_name, latitude, longitude, stop_sequence
        FROM route_shapes
        WHERE shape_group IS NOT NULL
        ORDER BY shape_group ASC, stop_sequence ASC
    `);

    const groups = {};
    for (const row of result.rows) {
        const g = row.shape_group;
        if (!groups[g]) {
            groups[g] = { label: row.route_label || `Route ${g}`, stations: [] };
        }
        groups[g].stations.push({
            name: row.station_name,
            lat: parseFloat(row.latitude),
            lon: parseFloat(row.longitude),
        });
    }
    return Object.values(groups);
}

// ─── In-memory dedup ──────────────────────────────────────────────────────────
// Tracks the last vehicle_ts (epoch seconds) seen per vehicle_id.
// If vehicle_ts hasn't changed since the last poll, the KTMB feed hasn't updated
// that vehicle's position — skip it to avoid storing redundant rows.
// Note: this map lives in process memory; it resets on restart, which is fine.
const lastSeenTs = new Map();

async function collect(routeShapes) {
    const recordedAt = new Date();

    // 1. Fetch GTFS-RT protobuf feed from KTMB
    const response = await fetch(GTFS_URL, {
        headers: { 'User-Agent': 'KTMB-MLCollector/1.0' },
        cache: 'no-store',
    });
    if (!response.ok) throw new Error(`GTFS fetch failed: ${response.status} ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(buffer)
    );

    const allVehicles = feed.entity
        .filter(e => e.vehicle?.position?.latitude && e.vehicle?.position?.longitude)
        .map(e => e.vehicle);

    // 2. Skip vehicles whose feed timestamp hasn't changed (feed not updated yet)
    const updatedVehicles = allVehicles.filter(v => {
        const id = v.vehicle?.id;
        if (!id) return false;
        const ts = getTimestamp(v.timestamp);
        if (lastSeenTs.get(id) === ts) return false;
        lastSeenTs.set(id, ts);
        return true;
    });

    if (updatedVehicles.length === 0) {
        console.log(`[${recordedAt.toISOString()}] ${allVehicles.length} vehicles in feed, none updated — skipping.`);
        return;
    }

    // 3. Determine atStation for each updated vehicle via GPS proximity
    const rows = updatedVehicles.map(v => {
        const lat = v.position.latitude;
        const lon = v.position.longitude;
        const pos = findTrainPosition(lat, lon, routeShapes);
        return {
            recordedAt,
            vehicleTs:      new Date(getTimestamp(v.timestamp) * 1000),
            tripId:         v.trip?.tripId         || null,
            routeId:        v.trip?.routeId        || null,
            vehicleId:      v.vehicle?.id          || null,
            vehicleLabel:   v.vehicle?.label       || null,
            latitude:       lat,
            longitude:      lon,
            bearing:        v.position.bearing     ?? null,
            speedKmh:       v.position.speed       ?? null,
            rawStatus:      v.currentStatus        ?? null,
            gtfsStopId:     v.stopId               || null,
            atStationName:  pos?.atStationName     || null,
            atStationIdx:   pos?.atStationIdx      ?? null,
            routeLabel:     pos?.routeLabel        || null,
        };
    });

    // 4. Batch insert — ON CONFLICT covers the rare case of two polls at the
    //    exact same recorded_at millisecond for the same vehicle+feed-timestamp.
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let inserted = 0;
        for (const r of rows) {
            const res = await client.query(`
                INSERT INTO vehicle_positions_log (
                    recorded_at, vehicle_ts, trip_id, route_id,
                    vehicle_id, vehicle_label,
                    latitude, longitude, bearing, speed_kmh,
                    raw_status, gtfs_stop_id,
                    at_station_name, at_station_idx, route_label
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                ON CONFLICT (recorded_at, vehicle_ts, vehicle_id) DO NOTHING
            `, [
                r.recordedAt,    r.vehicleTs,     r.tripId,       r.routeId,
                r.vehicleId,     r.vehicleLabel,
                r.latitude,      r.longitude,     r.bearing,      r.speedKmh,
                r.rawStatus,     r.gtfsStopId,
                r.atStationName, r.atStationIdx,  r.routeLabel,
            ]);
            inserted += res.rowCount;
        }
        await client.query('COMMIT');

        const atStation = rows.filter(r => r.atStationName).length;
        console.log(
            `[${recordedAt.toISOString()}] ` +
            `+${inserted} rows | ` +
            `${allVehicles.length} in feed, ${updatedVehicles.length} updated, ` +
            `${atStation} at station`
        );
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function main() {
    console.log('KTMB ML Collector starting...');
    console.log(`Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
    console.log(`DB: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

    // Verify DB connection on startup
    await pool.query('SELECT 1');
    console.log('DB connection OK.');

    // Load route shapes (refresh every 24h in case DB is updated)
    let routeShapes = await loadRouteShapes();
    console.log(`Loaded ${routeShapes.length} route shapes.`);

    setInterval(async () => {
        try {
            routeShapes = await loadRouteShapes();
            console.log(`[Route shapes refreshed] ${routeShapes.length} routes`);
        } catch (err) {
            console.error(`Failed to refresh route shapes: ${err.message}`);
        }
    }, 24 * 60 * 60 * 1000);

    // Run immediately, then on interval
    const run = async () => {
        try {
            await collect(routeShapes);
        } catch (err) {
            console.error(`Collection error: ${err.message}`);
        }
    };

    await run();
    setInterval(run, POLL_INTERVAL_MS);
}

main().catch(err => {
    console.error('Fatal startup error:', err.message);
    process.exit(1);
});
