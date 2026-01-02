'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useTheme } from 'next-themes';

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
        vehicle: {
            id: string;
            label: string;
            licensePlate: string;
        };
    };
}

export default function LiveMap() {
    const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
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

    useEffect(() => {
        fetchVehicles();
        const interval = setInterval(fetchVehicles, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, []);

    // Default center (Kuala Lumpur)
    const center: [number, number] = [3.140853, 101.693207];

    return (
        <div className="space-y-4">
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

            <div className="h-[calc(100vh-250px)] min-h-[500px] w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-white/10 relative transition-colors">
                <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url={isDark
                            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        }
                    />
                    {vehicles.map((v) => (
                        v.vehicle.position && (
                            <Marker
                                key={v.id}
                                position={[v.vehicle.position.latitude, v.vehicle.position.longitude]}
                                icon={L.divIcon({
                                    className: 'custom-icon', // Wrapper class to avoid default styles if needed, or just empty
                                    html: '<div class="blinking-marker"></div>',
                                    iconSize: [20, 20],
                                    iconAnchor: [10, 10]
                                })}
                            >
                                <Popup>
                                    <div className="p-2">
                                        <h3 className="font-bold text-lg mb-1 text-gray-900">Train {v.vehicle.vehicle.label || v.vehicle.vehicle.id}</h3>
                                        <div className="space-y-1 text-sm text-gray-700">
                                            <p><span className="font-semibold">Trip ID:</span> {v.vehicle.trip.tripId}</p>
                                            <p><span className="font-semibold">Route ID:</span> {v.vehicle.trip.routeId}</p>
                                            <p><span className="font-semibold">Speed:</span> {v.vehicle.position.speed?.toFixed(1) || 0} km/h</p>
                                            <p><span className="font-semibold">Timestamp:</span> {new Date(parseInt(v.vehicle.timestamp as any) * 1000).toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        )
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}
