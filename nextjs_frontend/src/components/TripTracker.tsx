'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getVehiclePositions, getRouteShapes, VehiclePosition, RouteShape, RouteStation } from '@/services/api';
import { MapPin, Train, Navigation, ArrowLeft, Map as MapIcon, RefreshCw } from 'lucide-react';

interface TripTrackerProps {
    tripId: string;
    onViewMap: () => void;
    onBack: () => void;
}

/** Haversine distance in km between two lat/lon points */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

const STATION_SNAP_DISTANCE_KM = 0.3; // 300m — snap to station when within this distance

/** Find which route and position the train is at based on GPS */
function findTrainPosition(
    trainLat: number,
    trainLon: number,
    routes: RouteShape[]
): { route: RouteShape; segmentIndex: number; fraction: number; atStation: number | null } | null {
    let bestRoute: RouteShape | null = null;
    let bestSegment = 0;
    let bestFraction = 0;
    let bestDist = Infinity;

    for (const route of routes) {
        const stations = route.stations;
        if (stations.length < 2) continue;

        for (let i = 0; i < stations.length - 1; i++) {
            const A = stations[i];
            const B = stations[i + 1];

            // Project train position onto segment A-B
            const dA = haversine(trainLat, trainLon, A.lat, A.lon);
            const dB = haversine(trainLat, trainLon, B.lat, B.lon);
            const dAB = haversine(A.lat, A.lon, B.lat, B.lon);

            // Fraction along segment (clamped 0-1)
            let fraction = 0;
            if (dAB > 0.01) {
                fraction = Math.max(0, Math.min(1, (dA * dA - dB * dB + dAB * dAB) / (2 * dAB * dAB)));
            }

            // Distance from train to the projected point on the segment
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

    // Only match if within 15km of a segment
    if (bestRoute && bestDist < 15) {
        // Check if train is within 300m of any station on the matched route — snap to it
        let atStation: number | null = null;
        for (let i = 0; i < bestRoute.stations.length; i++) {
            const s = bestRoute.stations[i];
            const d = haversine(trainLat, trainLon, s.lat, s.lon);
            if (d < STATION_SNAP_DISTANCE_KM) {
                atStation = i;
                break;
            }
        }

        return { route: bestRoute, segmentIndex: bestSegment, fraction: bestFraction, atStation };
    }
    return null;
}

export default function TripTracker({ tripId, onViewMap, onBack }: TripTrackerProps) {
    const [vehicle, setVehicle] = useState<VehiclePosition | null>(null);
    const [routes, setRoutes] = useState<RouteShape[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const trainMarkerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const hasAutoScrolled = useRef(false);

    const fetchData = useCallback(async () => {
        try {
            const [vehicleData, routeData] = await Promise.all([
                getVehiclePositions(),
                routes.length > 0 ? Promise.resolve(null) : getRouteShapes(),
            ]);

            // Find the specific vehicle
            const found = vehicleData.vehicles.find(v => v.vehicle.trip.tripId === tripId);
            setVehicle(found || null);
            if (!found) {
                setError('Train not found in live data. It may have completed its journey.');
            } else {
                setError(null);
            }

            if (routeData) setRoutes(routeData);
            setLastUpdate(new Date());
        } catch (e) {
            setError('Failed to fetch tracking data.');
        } finally {
            setLoading(false);
        }
    }, [tripId, routes.length]);

    // Initial fetch and auto refresh
    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Compute train position on route
    const trainPosition = useMemo(() => {
        if (!vehicle || routes.length === 0) return null;
        const pos = vehicle.vehicle.position;
        if (!pos?.latitude || !pos?.longitude) return null;
        return findTrainPosition(pos.latitude, pos.longitude, routes);
    }, [vehicle, routes]);

    // Auto-scroll to train position on first load
    useEffect(() => {
        if (trainMarkerRef.current && scrollContainerRef.current && !hasAutoScrolled.current) {
            hasAutoScrolled.current = true;
            setTimeout(() => {
                trainMarkerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 100);
        }
    }, [trainPosition]);

    const matchedRoute = trainPosition?.route;
    const speed = vehicle?.vehicle.position?.speed;

    if (loading) {
        return (
            <div className="bg-white dark:bg-white/5 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/10 p-8">
                <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Loading tracking data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header Card */}
            <div className="bg-white dark:bg-white/5 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/10 p-5">
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchData}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={16} />
                        </button>
                        <button
                            onClick={onViewMap}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-sm font-medium transition-colors"
                        >
                            <MapIcon size={14} />
                            View in Map
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 font-bold text-lg">
                        {tripId.split('_').pop()}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                {matchedRoute?.name || 'Tracking...'}
                            </h2>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                                Live
                            </span>
                        </div>
                        {speed !== undefined && speed !== null && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                <Navigation size={12} />
                                {Math.round(speed)} km/h
                            </p>
                        )}
                    </div>
                </div>
                {lastUpdate && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                        Last updated: {lastUpdate.toLocaleTimeString()}
                    </p>
                )}
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 text-center">
                    <p className="text-orange-700 dark:text-orange-300 text-sm">{error}</p>
                </div>
            )}

            {/* Route Diagram */}
            {matchedRoute && trainPosition && (
                <div className="bg-white dark:bg-white/5 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/10 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: matchedRoute.color }} />
                        Route Progress
                    </h3>

                    <div ref={scrollContainerRef} className="relative pl-24 md:pl-28 max-h-[220px] overflow-y-auto scrollbar-hide mx-auto w-fit">
                        {matchedRoute.stations.map((station, idx) => {
                            const isFirst = idx === 0;
                            const isLast = idx === matchedRoute.stations.length - 1;
                            const isTrainAtThisStation = trainPosition.atStation === idx;
                            const isPassed = trainPosition.atStation !== null
                                ? idx < trainPosition.atStation
                                : (idx < trainPosition.segmentIndex || (idx === trainPosition.segmentIndex && trainPosition.fraction > 0.9));
                            const isCurrent = isTrainAtThisStation ||
                                (trainPosition.atStation === null && idx === trainPosition.segmentIndex && trainPosition.fraction <= 0.9);

                            // Show floating train indicator between this station and the next (only when not snapped to a station)
                            const showFloatingTrain = trainPosition.atStation === null && idx === trainPosition.segmentIndex && !isLast;

                            // Attach ref to the element nearest to the train
                            const isTrainRef = isTrainAtThisStation || showFloatingTrain;

                            return (
                                <div key={idx} className="relative" ref={isTrainRef ? trainMarkerRef : undefined}>
                                    {/* Connection line to next station */}
                                    {!isLast && (
                                        <div
                                            className="absolute left-0 w-0.5 top-3 -translate-x-[7px]"
                                            style={{
                                                height: '100%',
                                                backgroundColor: isPassed || isTrainAtThisStation ? matchedRoute.color : 'rgb(209 213 219)',
                                                opacity: isPassed || isTrainAtThisStation ? 0.8 : 0.4,
                                            }}
                                        />
                                    )}

                                    {/* Station dot + optional train-at-station indicator */}
                                    <div className="flex items-center gap-3 py-2 relative">
                                        {isTrainAtThisStation ? (
                                            /* Train is AT this station — show train icon instead of plain dot */
                                            <div
                                                className="absolute left-0 -translate-x-[20px] z-20 w-7 h-7 rounded-full flex items-center justify-center shadow-lg"
                                                style={{ backgroundColor: matchedRoute.color }}
                                            >
                                                <Train size={14} className="text-white" />
                                            </div>
                                        ) : (
                                            /* Regular station dot */
                                            <div
                                                className="absolute left-0 -translate-x-[11px] z-10 rounded-full border-2 transition-all duration-500"
                                                style={{
                                                    width: (isFirst || isLast) ? 14 : 10,
                                                    height: (isFirst || isLast) ? 14 : 10,
                                                    backgroundColor: isPassed || isCurrent ? matchedRoute.color : 'white',
                                                    borderColor: isPassed || isCurrent ? matchedRoute.color : 'rgb(209 213 219)',
                                                }}
                                            />
                                        )}

                                        <span
                                            className={`text-sm transition-all duration-300 ml-3 ${isTrainAtThisStation
                                                ? 'font-bold text-gray-900 dark:text-white'
                                                : isPassed || isCurrent
                                                    ? 'font-semibold text-gray-900 dark:text-white'
                                                    : 'text-gray-400 dark:text-gray-500'
                                                } ${(isFirst || isLast) ? 'font-bold text-base' : ''}`}
                                        >
                                            {station.name}
                                        </span>

                                        {/* "Stopped" label when at station with speed 0 */}
                                        {isTrainAtThisStation && speed !== undefined && speed === 0 && (
                                            <span
                                                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-white"
                                                style={{ backgroundColor: matchedRoute.color }}
                                            >
                                                Stopped
                                            </span>
                                        )}
                                        {isTrainAtThisStation && speed !== undefined && speed > 0 && (
                                            <span
                                                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-white"
                                                style={{ backgroundColor: matchedRoute.color }}
                                            >
                                                {Math.round(speed)} km/h
                                            </span>
                                        )}
                                    </div>

                                    {/* Floating train indicator between stations */}
                                    {showFloatingTrain && (
                                        <div
                                            className="absolute left-0 -translate-x-[20px] z-20 transition-all duration-1000 ease-in-out"
                                            style={{
                                                top: `${24 + trainPosition.fraction * 24}px`,
                                            }}
                                        >
                                            <div className="relative flex items-center">
                                                <div
                                                    className="w-7 h-7 rounded-full flex items-center justify-center shadow-lg animate-pulse"
                                                    style={{ backgroundColor: matchedRoute.color }}
                                                >
                                                    <Train size={14} className="text-white" />
                                                </div>
                                                {speed !== undefined && speed > 0 && (
                                                    <span
                                                        className="absolute right-full mr-2 text-xs font-bold px-1.5 py-0.5 rounded-md text-white whitespace-nowrap"
                                                        style={{ backgroundColor: matchedRoute.color }}
                                                    >
                                                        {Math.round(speed)} km/h
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* No match fallback — show GPS only */}
            {vehicle && !matchedRoute && !error && (
                <div className="bg-white dark:bg-white/5 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-white/10 p-5 text-center">
                    <MapPin size={24} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        GPS: {vehicle.vehicle.position.latitude.toFixed(4)}, {vehicle.vehicle.position.longitude.toFixed(4)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Could not match train to a known route
                    </p>
                </div>
            )}
        </div>
    );
}
