// Snaps a live train GPS fix onto a route's station list.
// This is the single source of truth for train position matching; the web
// and Flutter clients read the result from /api/gtfs/vehicle-positions
// (vehicle.trackPosition) instead of computing it themselves.

const EARTH_RADIUS_KM = 6371;
const STATION_SNAP_DISTANCE_KM = 0.3; // snap to a station when within 300m
const MAX_MATCH_DISTANCE_KM = 15; // ignore matches further than this from any segment

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in km between two lat/lon points. */
function haversine(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the route segment closest to the train.
 * routes: [{ shapeGroup, name, stations: [{ name, lat, lon }] }]
 * Returns { shapeGroup, routeName, segmentIndex, fraction, atStation, atStationName }
 * or null when nothing is within MAX_MATCH_DISTANCE_KM.
 */
function findTrainPosition(trainLat, trainLon, routes) {
    let bestRoute = null;
    let bestSegment = 0;
    let bestFraction = 0;
    let bestDist = Infinity;

    for (const route of routes) {
        const stations = route.stations;
        if (!stations || stations.length < 2) continue;

        for (let i = 0; i < stations.length - 1; i++) {
            const A = stations[i];
            const B = stations[i + 1];

            const dA = haversine(trainLat, trainLon, A.lat, A.lon);
            const dB = haversine(trainLat, trainLon, B.lat, B.lon);
            const dAB = haversine(A.lat, A.lon, B.lat, B.lon);

            // Fraction along A-B, clamped to [0, 1]
            let fraction = 0;
            if (dAB > 0.01) {
                fraction = Math.max(0, Math.min(1, (dA * dA - dB * dB + dAB * dAB) / (2 * dAB * dAB)));
            }

            // Planar interpolation is fine for station-to-station distances
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

    if (!bestRoute || bestDist >= MAX_MATCH_DISTANCE_KM) return null;

    let atStation = null;
    for (let i = 0; i < bestRoute.stations.length; i++) {
        const s = bestRoute.stations[i];
        if (haversine(trainLat, trainLon, s.lat, s.lon) < STATION_SNAP_DISTANCE_KM) {
            atStation = i;
            break;
        }
    }

    return {
        shapeGroup: bestRoute.shapeGroup,
        routeName: bestRoute.name,
        segmentIndex: bestSegment,
        fraction: bestFraction,
        atStation,
        atStationName: atStation !== null ? bestRoute.stations[atStation].name : null,
    };
}

/**
 * Match a vehicle to its own GTFS route first, so trains on parallel tracks
 * (e.g. Mid Valley vs Abdullah Hukum) don't snap to the wrong line. Falls
 * back to every route when the routeId is missing or unknown.
 */
function positionForVehicle(lat, lon, routeId, routes) {
    if (!lat || !lon || !routes || routes.length === 0) return null;
    let candidates = routes;
    if (routeId) {
        const own = routes.filter((r) => r.gtfsRouteId === routeId);
        if (own.length > 0) candidates = own;
    }
    return findTrainPosition(lat, lon, candidates);
}

module.exports = {
    haversine,
    findTrainPosition,
    positionForVehicle,
    STATION_SNAP_DISTANCE_KM,
};
