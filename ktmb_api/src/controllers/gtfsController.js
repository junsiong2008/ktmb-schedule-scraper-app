const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const db = require('../config/db');

// Simple in-memory cache
let cachedData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30 * 1000; // 30 seconds

// Cache for route shapes (rarely changes)
let cachedShapes = null;
let shapesCacheTime = 0;
const SHAPES_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const getVehiclePositions = async (req, res) => {
    try {
        const now = Date.now();

        // Serve from cache if valid
        if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
            console.log('Serving GTFS data from cache');
            return res.json(cachedData);
        }

        console.log('Fetching fresh GTFS data');
        const response = await fetch('https://api.data.gov.my/gtfs-realtime/vehicle-position/ktmb', {
            headers: {
                'User-Agent': 'KTMB-Timetable-App/1.0',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch GTFS data: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
            new Uint8Array(buffer)
        );

        // Helper to get timestamp as number (handle Long object from protobuf)
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
                    },
                };
            }
            return null;
        }).filter(Boolean);

        // Update cache
        cachedData = {
            timestamp: getTimestamp(feed.header?.timestamp),
            vehicles: vehiclePositions,
        };
        lastFetchTime = now;

        res.json(cachedData);
    } catch (error) {
        console.error('Error fetching GTFS data:', error);

        // Try serving stale cache if available
        if (cachedData) {
            console.warn('Serving stale GTFS data due to error');
            return res.json(cachedData);
        }

        res.status(500).json({ error: 'Failed to fetch vehicle positions' });
    }
};

const getRouteShapes = async (req, res) => {
    try {
        const now = Date.now();

        // Serve from cache if valid
        if (cachedShapes && (now - shapesCacheTime < SHAPES_CACHE_DURATION)) {
            return res.json(cachedShapes);
        }

        const result = await db.query(`
            SELECT shape_group, route_label, route_color, station_name, latitude, longitude, stop_sequence, shape_dist_traveled
            FROM route_shapes
            WHERE shape_group IS NOT NULL
            ORDER BY shape_group ASC, stop_sequence ASC
        `);

        if (result.rows.length === 0) {
            return res.json([]);
        }

        // Group by shape_group
        const groupedRoutes = {};
        for (const row of result.rows) {
            const group = row.shape_group;
            if (!groupedRoutes[group]) {
                groupedRoutes[group] = {
                    name: row.route_label || `Route ${group}`,
                    color: row.route_color || '#888888',
                    coordinates: [],
                    stations: [],
                };
            }
            groupedRoutes[group].coordinates.push([row.latitude, row.longitude]);
            groupedRoutes[group].stations.push({
                name: row.station_name,
                lat: row.latitude,
                lon: row.longitude,
                distTraveled: row.shape_dist_traveled,
            });
        }

        const routeData = Object.values(groupedRoutes);

        cachedShapes = routeData;
        shapesCacheTime = now;

        res.json(routeData);
    } catch (error) {
        console.error('Error fetching route shapes:', error);
        res.status(500).json({ error: 'Failed to fetch route shapes' });
    }
};

module.exports = {
    getVehiclePositions,
    getRouteShapes,
};

