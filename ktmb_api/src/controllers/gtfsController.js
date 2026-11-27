const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const db = require('../config/db');
const { positionForVehicle } = require('../utils/trainPosition');

// Simple in-memory cache
let cachedData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30 * 1000; // 30 seconds

// The upstream feed (api.data.gov.my) intermittently returns a valid-but-empty
// feed (0 entities) or a truncated protobuf between good responses. Keep the
// last non-empty snapshot and prefer it over an empty one for a grace period,
// so a single bad upstream response doesn't show "0 active trains".
let lastGoodData = null;
let lastGoodTime = 0;
const EMPTY_GRACE_PERIOD = 3 * 60 * 1000; // 3 minutes
const FETCH_TIMEOUT = 8 * 1000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY = 1000;
let inFlight = null; // dedupe concurrent upstream fetches

// Cache for route shapes (rarely changes)
let cachedShapes = null;
let shapesCacheTime = 0;
const SHAPES_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch + decode once. Throws on HTTP error, timeout, or corrupt protobuf.
const fetchFeedOnce = async () => {
    const response = await fetch('https://api.data.gov.my/gtfs-realtime/vehicle-position/ktmb', {
        headers: { 'User-Agent': 'KTMB-Timetable-App/1.0' },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch GTFS data: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
};

// Retry on errors and on empty feeds; return the best feed seen (may be empty).
const fetchFeedWithRetry = async () => {
    let emptyFeed = null;
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const feed = await fetchFeedOnce();
            if (feed.entity && feed.entity.length > 0) return feed;
            emptyFeed = feed;
        } catch (err) {
            lastError = err;
            console.warn(`GTFS fetch attempt ${attempt} failed: ${err.message}`);
        }
        if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY);
    }
    if (emptyFeed) return emptyFeed;
    throw lastError;
};

const getVehiclePositions = async (req, res) => {
    try {
        const now = Date.now();

        // Serve from cache if valid
        if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
            return res.json(cachedData);
        }

        if (!inFlight) {
            inFlight = refreshVehiclePositions().finally(() => { inFlight = null; });
        }
        res.json(await inFlight);
    } catch (error) {
        console.error('Error fetching GTFS data:', error);

        // Try serving stale cache if available
        const fallback = lastGoodData || cachedData;
        if (fallback) {
            console.warn('Serving stale GTFS data due to error');
            return res.json(fallback);
        }

        res.status(500).json({ error: 'Failed to fetch vehicle positions' });
    }
};

const refreshVehiclePositions = async () => {
    const now = Date.now();
    const [feed, routes] = await Promise.all([
        fetchFeedWithRetry(),
        // Positions are a bonus: if shapes can't load, still serve vehicles.
        loadRouteShapes().catch((err) => {
            console.warn(`Route shapes unavailable for position matching: ${err.message}`);
            return [];
        }),
    ]);
    // Helper to get timestamp as number (handle Long object from protobuf)
    const getTimestamp = (ts) => {
        if (!ts) return Date.now() / 1000;

        // If it's already a number, return it
        if (typeof ts === 'number') return ts;

        // If it's a Long object (has low/high or toNumber method)
        if (ts && typeof ts === 'object') {
            if (typeof ts.toNumber === 'function') {
                return ts.toNumber();
            }
            if (ts.low !== undefined) {
                return ts.low;
            }
        }

        // Try parsing as integer if string
        if (typeof ts === 'string') {
            const parsed = parseInt(ts, 10);
            if (!isNaN(parsed)) return parsed;
        }

        return Date.now() / 1000;
    };

    const vehiclePositions = feed.entity.map((entity) => {
        if (entity.vehicle) {
            return {
                id: entity.id,
                vehicle: {
                    trip: {
                        tripId: entity.vehicle.trip?.tripId,
                        routeId: entity.vehicle.trip?.routeId || entity.vehicle.trip?.route_id,
                        startTime: entity.vehicle.trip?.startTime,
                        startDate: entity.vehicle.trip?.startDate,
                    },
                    position: {
                        latitude: entity.vehicle.position?.latitude,
                        longitude: entity.vehicle.position?.longitude,
                        bearing: entity.vehicle.position?.bearing,
                        speed: entity.vehicle.position?.speed,
                    },
                    timestamp: getTimestamp(entity.vehicle.timestamp),
                    currentStatus: entity.vehicle.currentStatus,
                    stopId: entity.vehicle.stopId,
                    vehicle: {
                        id: entity.vehicle.vehicle?.id,
                        label: entity.vehicle.vehicle?.label,
                        licensePlate: entity.vehicle.vehicle?.licensePlate,
                    },
                    // Where the train sits on its route (computed server-side; see utils/trainPosition.js)
                    trackPosition: positionForVehicle(
                        entity.vehicle.position?.latitude,
                        entity.vehicle.position?.longitude,
                        entity.vehicle.trip?.routeId || entity.vehicle.trip?.route_id,
                        routes,
                    ),
                },
            };
        }
        return null;
    }).filter(Boolean);

    const freshData = {
        timestamp: getTimestamp(feed.header?.timestamp),
        vehicles: vehiclePositions,
    };

    if (vehiclePositions.length > 0) {
        lastGoodData = freshData;
        lastGoodTime = now;
        cachedData = freshData;
    } else if (lastGoodData && now - lastGoodTime < EMPTY_GRACE_PERIOD) {
        // Upstream blip: keep showing the last known trains.
        console.warn('GTFS feed empty; serving last known good snapshot');
        cachedData = lastGoodData;
    } else {
        // Genuinely no trains (e.g. overnight) — accept the empty feed.
        cachedData = freshData;
    }
    lastFetchTime = now;

    return cachedData;
};

// Load route shapes grouped by shape_group, cached for 24h.
const loadRouteShapes = async () => {
    const now = Date.now();
    if (cachedShapes && (now - shapesCacheTime < SHAPES_CACHE_DURATION)) {
        return cachedShapes;
    }

    const result = await db.query(`
        SELECT shape_group, route_label, route_color, gtfs_route_id, station_name, latitude, longitude, stop_sequence, shape_dist_traveled, gtfs_stop_id
        FROM route_shapes
        WHERE shape_group IS NOT NULL
        ORDER BY shape_group ASC, stop_sequence ASC
    `);

    // Group by shape_group
    const groupedRoutes = {};
    for (const row of result.rows) {
        const group = row.shape_group;
        if (!groupedRoutes[group]) {
            groupedRoutes[group] = {
                shapeGroup: group,
                name: row.route_label || `Route ${group}`,
                color: row.route_color || '#888888',
                gtfsRouteId: row.gtfs_route_id,
                coordinates: [],
                stations: [],
            };
        }
        groupedRoutes[group].coordinates.push([row.latitude, row.longitude]);

        // Only add to stations array if it's an actual station (has a name)
        if (row.station_name) {
            groupedRoutes[group].stations.push({
                name: row.station_name,
                lat: row.latitude,
                lon: row.longitude,
                distTraveled: row.shape_dist_traveled,
                gtfsStopId: row.gtfs_stop_id,
            });
        }
    }

    const routeData = Object.values(groupedRoutes);
    if (routeData.length > 0) {
        cachedShapes = routeData;
        shapesCacheTime = now;
    }
    return routeData;
};

const getRouteShapes = async (req, res) => {
    try {
        res.json(await loadRouteShapes());
    } catch (error) {
        console.error('Error fetching route shapes:', error);
        res.status(500).json({ error: 'Failed to fetch route shapes' });
    }
};

module.exports = {
    getVehiclePositions,
    getRouteShapes,
};
