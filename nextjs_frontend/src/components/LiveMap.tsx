'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useTheme } from 'next-themes';
import { X } from 'lucide-react';

// Fix for default marker icon in Next.js / Webpack
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Define types for our vehicle data
interface VehiclePosition {
    id: string;
    vehicle: {
        trip: {
            tripId: string;
            routeId: string;
            startTime: string;
            startDate: string;
        };
        position: {
            latitude: number;
            longitude: number;
            bearing: number;
            speed: number;
        };
        timestamp: number;
        currentStatus: number;
        stopId: string;
        vehicle: {
            id: string;
            label: string;
            licensePlate: string;
        };
    };
}

interface RouteShape {
    name: string;
    color: string;
    gtfsRouteId: string;
    coordinates: [number, number][];
    stations: {
        name: string;
        lat: number;
        lon: number;
        distTraveled: number;
    }[];
}

interface LiveMapProps {
    focusTripId?: string | null;
    onClearFocus?: () => void;
    /** When true, only show the route and train for the focused trip (no other trains/routes/chrome) */
    tripOnly?: boolean;
    /** Called when a train marker is clicked on the map */
    onSelectTrip?: (tripId: string) => void;
}

// Sub-component to handle map flying (needs useMap hook inside MapContainer)
function MapFocuser({ vehicles, focusTripId }: { vehicles: VehiclePosition[]; focusTripId: string | null }) {
    const map = useMap();
    const hasFocused = useRef(false);

    useEffect(() => {
        if (!focusTripId || hasFocused.current) return;

        const target = vehicles.find(v => v.vehicle.trip.tripId === focusTripId);
        if (target?.vehicle.position) {
            map.flyTo(
                [target.vehicle.position.latitude, target.vehicle.position.longitude],
                14,
                { duration: 1.5 }
            );
            hasFocused.current = true;
        }
    }, [vehicles, focusTripId, map]);

    // Reset if focusTripId changes
    useEffect(() => {
        hasFocused.current = false;
    }, [focusTripId]);

    return null;
}

export default function LiveMap({ focusTripId = null, onClearFocus, tripOnly = false, onSelectTrip }: LiveMapProps) {
    const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
    const [routeShapes, setRouteShapes] = useState<RouteShape[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    const fetchVehicles = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
            const res = await fetch(`${apiUrl}/gtfs/vehicle-positions`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setVehicles(data.vehicles || []);
            const ts = typeof data.timestamp === 'number' ? data.timestamp : parseInt(data.timestamp || '0');
            setLastUpdated(new Date(ts * 1000));
        } catch (err) {
            console.error(err);
        }
    };

    const fetchRouteShapes = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
            const res = await fetch(`${apiUrl}/gtfs/route-shapes`);
            if (!res.ok) throw new Error('Failed to fetch route shapes');
            const data = await res.json();
            setRouteShapes(data || []);
        } catch (err) {
            console.error('Failed to fetch route shapes:', err);
        }
    };

    useEffect(() => {
        fetchVehicles();
        fetchRouteShapes(); // Fetch once on mount (static data)
        const interval = setInterval(fetchVehicles, 30000); // Update vehicles every 30 seconds
        return () => clearInterval(interval);
    }, []);

    // Extract the train number from tripId for display (e.g. "weekday_2067" -> "2067")
    const getTrainNumber = (tripId: string) => {
        if (!tripId) return '';
        const parts = tripId.split('_');
        return parts.length > 1 ? parts.slice(1).join('_') : tripId;
    };

    // Default center (Kuala Lumpur)
    const center: [number, number] = [3.140853, 101.693207];

    const focusedVehicle = focusTripId
        ? vehicles.find(v => v.vehicle.trip.tripId === focusTripId)
        : null;

    // In tripOnly mode, filter to only the focused train's route
    const displayRoutes = tripOnly && focusedVehicle
        ? routeShapes.filter(r => r.gtfsRouteId === focusedVehicle.vehicle.trip.routeId)
        : routeShapes;
    const displayVehicles = tripOnly
        ? vehicles.filter(v => focusTripId && v.vehicle.trip.tripId === focusTripId)
        : vehicles;

    return (
        <div className="space-y-4">
            {/* Focused train banner — hidden in tripOnly mode (TripTracker already shows this) */}
            {!tripOnly && focusTripId && (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                            Tracking Train {getTrainNumber(focusTripId)}
                        </span>
                        {focusedVehicle && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                · {(() => {
                                    const status = focusedVehicle.vehicle.currentStatus;
                                    const stopId = focusedVehicle.vehicle.stopId;
                                    if (status === 0) return stopId ? `Incoming at ${stopId}` : 'Arriving';
                                    if (status === 1) return stopId ? `Stopped at ${stopId}` : 'Stopped';
                                    if (status === 2) return stopId ? `In transit to ${stopId}` : 'In Transit';
                                    return 'Unknown';
                                })()}
                            </span>
                        )}
                    </div>
                    {onClearFocus && (
                        <button
                            onClick={onClearFocus}
                            className="p-1 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-700 dark:text-emerald-300 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            )}

            {/* Stats bar — hidden in tripOnly mode */}
            {!tripOnly && (
                <div className="flex flex-wrap gap-3 items-center justify-between bg-white dark:bg-white/5 dark:backdrop-blur-md p-4 rounded-xl shadow-sm border border-gray-100 dark:border-white/10 transition-colors">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-800 transition-colors">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                            </span>
                            {vehicles.length} Active Trains
                        </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium bg-gray-50 dark:bg-white/10 px-3 py-1.5 rounded-full border border-gray-100 dark:border-white/5 transition-colors">
                        Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '...'}
                    </div>
                </div>
            )}

            {/* Route legend — hidden in tripOnly mode */}
            {!tripOnly && routeShapes.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                    {routeShapes.map((route, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400"
                        >
                            <span
                                className="inline-block w-4 h-1 rounded-full"
                                style={{ backgroundColor: route.color }}
                            ></span>
                            {route.name}
                        </div>
                    ))}
                </div>
            )}

            <div className={`${tripOnly ? 'h-[400px]' : 'h-[calc(100vh-250px)] min-h-[500px]'} w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-white/10 relative z-0 transition-colors`}>
                <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url={isDark
                            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        }
                    />
                    <MapFocuser vehicles={displayVehicles} focusTripId={focusTripId} />

                    {/* Render track lines */}
                    {displayRoutes.map((route, idx) => (
                        <Polyline
                            key={`track-${idx}`}
                            positions={route.coordinates}
                            pathOptions={{
                                color: route.color,
                                weight: 3,
                                opacity: 0.7,
                                dashArray: undefined,
                            }}
                        />
                    ))}

                    {/* Render station dots on tracks */}
                    {displayRoutes.map((route, routeIdx) =>
                        route.stations.map((station, stationIdx) => (
                            <CircleMarker
                                key={`station-${routeIdx}-${stationIdx}`}
                                center={[station.lat, station.lon]}
                                radius={3}
                                pathOptions={{
                                    color: route.color,
                                    fillColor: isDark ? '#1e293b' : '#ffffff',
                                    fillOpacity: 1,
                                    weight: 2,
                                }}
                            >
                                <Tooltip direction="top" offset={[0, -5]}>
                                    <span className="text-xs font-medium">{station.name}</span>
                                </Tooltip>
                            </CircleMarker>
                        ))
                    )}

                    {/* Render train markers */}
                    {displayVehicles.map((v) => {
                        const isFocused = focusTripId && v.vehicle.trip.tripId === focusTripId;
                        const isDimmed = focusTripId && !isFocused;

                        return v.vehicle.position && (
                            <Marker
                                key={v.id}
                                position={[v.vehicle.position.latitude, v.vehicle.position.longitude]}
                                icon={L.divIcon({
                                    className: 'custom-icon',
                                    html: isFocused
                                        ? '<div class="focused-marker"></div>'
                                        : `<div class="blinking-marker${isDimmed ? ' dimmed-marker' : ''}"></div>`,
                                    iconSize: isFocused ? [28, 28] : [20, 20],
                                    iconAnchor: isFocused ? [14, 14] : [10, 10],
                                })}
                                zIndexOffset={isFocused ? 1000 : 0}
                                eventHandlers={onSelectTrip ? {
                                    click: () => onSelectTrip(v.vehicle.trip.tripId),
                                } : undefined}
                            >
                                <Popup>
                                    <div className="p-2">
                                        <h3 className="font-bold text-lg mb-1 text-gray-900">Train {v.vehicle.vehicle.label || v.vehicle.vehicle.id}</h3>
                                        <div className="space-y-1 text-sm text-gray-700">
                                            <p><span className="font-semibold">Trip ID:</span> {v.vehicle.trip.tripId}</p>
                                            <p><span className="font-semibold">Status:</span> {
                                                (() => {
                                                    const status = v.vehicle.currentStatus;
                                                    const stopId = v.vehicle.stopId;

                                                    if (status === 0) return stopId ? `Incoming at ${stopId}` : 'Arriving';
                                                    if (status === 1) return stopId ? `Stopped at ${stopId}` : 'Stopped';
                                                    if (status === 2) return stopId ? `In transit to ${stopId}` : 'In Transit';

                                                    return 'Unknown Status';
                                                })()
                                            }</p>
                                            <p><span className="font-semibold">Speed:</span> {v.vehicle.position.speed?.toFixed(1) || 0} km/h</p>
                                            <p><span className="font-semibold">Timestamp:</span> {
                                                (() => {
                                                    const date = new Date(v.vehicle.timestamp * 1000);
                                                    return isNaN(date.getTime()) ? 'Unknown Time' : date.toLocaleTimeString();
                                                })()
                                            }</p>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
}

