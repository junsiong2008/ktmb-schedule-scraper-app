const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

// Simple in-memory cache
let cachedData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30 * 1000; // 30 seconds

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

        const vehiclePositions = feed.entity.map((entity) => {
            if (entity.vehicle) {
                return {
                    id: entity.id,
                    vehicle: {
                        trip: {
                            tripId: entity.vehicle.trip?.tripId,
                            routeId: entity.vehicle.trip?.routeId,
                            startTime: entity.vehicle.trip?.startTime,
                            startDate: entity.vehicle.trip?.startDate,
                        },
                        position: {
                            latitude: entity.vehicle.position?.latitude,
                            longitude: entity.vehicle.position?.longitude,
                            bearing: entity.vehicle.position?.bearing,
                            speed: entity.vehicle.position?.speed,
                        },
                        timestamp: entity.vehicle.timestamp,
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

        // Helper to get timestamp as number (handle Long object from protobuf)
        const getTimestamp = (ts) => {
            if (!ts) return Date.now() / 1000;
            if (typeof ts === 'number') return ts;
            if (ts.low !== undefined) return ts.low; // Handle Long object
            return Date.now() / 1000;
        };

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

module.exports = {
    getVehiclePositions,
};
