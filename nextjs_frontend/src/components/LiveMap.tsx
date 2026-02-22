'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useTheme } from 'next-themes';
import { X, ChevronDown, Train, Zap } from 'lucide-react';

// Fix for default marker icon in Next.js / Webpack
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface VehiclePosition {
    id: string;
    vehicle: {
        trip: { tripId: string; routeId: string; startTime: string; startDate: string; };
        position: { latitude: number; longitude: number; bearing: number; speed: number; };
        timestamp: number;
        currentStatus: number;
        stopId: string;
        vehicle: { id: string; label: string; licensePlate: string; };
    };
}

interface RouteShape {
    name: string;
    color: string;
    gtfsRouteId: string;
    coordinates: [number, number][];
    stations: { name: string; lat: number; lon: number; distTraveled: number; }[];
}

interface LiveMapProps {
    focusTripId?: string | null;
    onClearFocus?: () => void;
    tripOnly?: boolean;
    onSelectTrip?: (tripId: string) => void;
    /** Called when the train-list panel is collapsed, so the parent can clear TripTracker */
    onClearSelection?: () => void;
}

// ── Internal Leaflet sub-components ──────────────────────────────────────────

/** Flies to a URL-param focused train once (has hasFocused guard). */
function MapFocuser({ vehicles, focusTripId }: { vehicles: VehiclePosition[]; focusTripId: string | null }) {
    const map = useMap();
    const hasFocused = useRef(false);

    useEffect(() => {
        if (!focusTripId || hasFocused.current) return;
        const t = vehicles.find(v => v.vehicle.trip.tripId === focusTripId);
        if (t?.vehicle.position) {
            map.flyTo([t.vehicle.position.latitude, t.vehicle.position.longitude], 14, { duration: 1.5 });
            hasFocused.current = true;
        }
    }, [vehicles, focusTripId, map]);

    useEffect(() => { hasFocused.current = false; }, [focusTripId]);
    return null;
}

/** Flies to any programmatically selected train (no hasFocused guard). */
function MapPanner({ vehicles, tripId }: { vehicles: VehiclePosition[]; tripId: string | null }) {
    const map = useMap();
    useEffect(() => {
        if (!tripId) return;
        const t = vehicles.find(v => v.vehicle.trip.tripId === tripId);
        if (t?.vehicle.position) {
            map.flyTo([t.vehicle.position.latitude, t.vehicle.position.longitude], 14, { duration: 0.8 });
        }
    }, [tripId, vehicles, map]);
    return null;
}

/** Resets the map view to the KL overview. */
function MapResetter({ trigger }: { trigger: number }) {
    const map = useMap();
    useEffect(() => {
        if (trigger === 0) return;
        map.flyTo([3.140853, 101.693207], 12, { duration: 1 });
    }, [trigger, map]);
    return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusText(v: VehiclePosition): string {
    const { currentStatus: s, stopId } = v.vehicle;
    if (s === 0) return stopId ? `Incoming · ${stopId}` : 'Arriving';
    if (s === 1) return stopId ? `Stopped · ${stopId}` : 'Stopped';
    if (s === 2) return 'In Transit';
    return 'Unknown';
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LiveMap({ focusTripId = null, onClearFocus, tripOnly = false, onSelectTrip, onClearSelection }: LiveMapProps) {
    const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
    const [routeShapes, setRouteShapes] = useState<RouteShape[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [legendOpen, setLegendOpen] = useState(false);

    // Train-list panel state
    const [showTrainList, setShowTrainList] = useState(false);
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null); // highlighted in sidebar / carousel
    const [panToTripId, setPanToTripId] = useState<string | null>(null);        // drives MapPanner
    const [resetMapTrigger, setResetMapTrigger] = useState(0);                  // drives MapResetter

    // Mobile carousel
    const [carouselIndex, setCarouselIndex] = useState(0);
    const carouselRef = useRef<HTMLDivElement>(null);
    const carouselIndexRef = useRef(0);   // stable ref for scroll closure
    const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Stable ref for vehicles (avoids stale closures in scroll handler)
    const vehiclesRef = useRef<VehiclePosition[]>([]);
    useEffect(() => { vehiclesRef.current = vehicles; }, [vehicles]);
    useEffect(() => { carouselIndexRef.current = carouselIndex; }, [carouselIndex]);

    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // ── Data fetching ──────────────────────────────────────────────────────

    const fetchVehicles = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
            const res = await fetch(`${apiUrl}/gtfs/vehicle-positions`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setVehicles(data.vehicles || []);
            const ts = typeof data.timestamp === 'number' ? data.timestamp : parseInt(data.timestamp || '0');
            setLastUpdated(new Date(ts * 1000));
        } catch (err) { console.error(err); }
    };

    const fetchRouteShapes = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
            const res = await fetch(`${apiUrl}/gtfs/route-shapes`);
            if (!res.ok) throw new Error('Failed to fetch route shapes');
            setRouteShapes(await res.json() || []);
        } catch (err) { console.error('Failed to fetch route shapes:', err); }
    };

    useEffect(() => {
        fetchVehicles();
        fetchRouteShapes();
        const interval = setInterval(fetchVehicles, 30000);
        return () => clearInterval(interval);
    }, []);

    // ── Carousel: pan map when the active card changes ─────────────────────

    useEffect(() => {
        if (!showTrainList) return;
        const v = vehiclesRef.current[carouselIndex];
        if (v?.vehicle.position) {
            const tid = v.vehicle.trip.tripId;
            setPanToTripId(tid);
            setSelectedTripId(tid);
        }
    }, [carouselIndex, showTrainList]);

    // ── Carousel: scroll to the correct card after the panel opens ─────────

    useEffect(() => {
        if (!showTrainList) return;
        // Use rAF so the DOM is painted before we measure offsets
        requestAnimationFrame(() => {
            const container = carouselRef.current;
            if (!container) return;
            const card = container.querySelector<HTMLElement>(`[data-ci="${carouselIndexRef.current}"]`);
            if (card) {
                // Center the card: scrollLeft = card.offsetLeft - (containerWidth - cardWidth) / 2
                container.scrollLeft = card.offsetLeft - (container.clientWidth - card.offsetWidth) / 2;
            }
        });
    }, [showTrainList]);

    // ── Carousel: detect active card from scroll position ──────────────────

    const handleCarouselScroll = useCallback(() => {
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
        // 120 ms gives snap-scroll time to settle before we measure
        scrollTimerRef.current = setTimeout(() => {
            const container = carouselRef.current;
            if (!container) return;
            const center = container.scrollLeft + container.clientWidth / 2;
            const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-ci]'));
            let closest = { index: 0, dist: Infinity };
            cards.forEach((el, i) => {
                const d = Math.abs((el.offsetLeft + el.offsetWidth / 2) - center);
                if (d < closest.dist) closest = { index: i, dist: d };
            });
            if (closest.index !== carouselIndexRef.current) {
                setCarouselIndex(closest.index);
            }
        }, 120);
    }, []);

    // ── Toggle the train-list panel ────────────────────────────────────────

    const handleToggleTrainList = () => {
        if (!showTrainList) {
            // Find a good starting card: previously selected or URL-focused train
            const focused = selectedTripId || focusTripId;
            let initial = 0;
            if (focused) {
                const idx = vehiclesRef.current.findIndex(v => v.vehicle.trip.tripId === focused);
                if (idx !== -1) initial = idx;
            }
            carouselIndexRef.current = initial;
            setCarouselIndex(initial);
            setShowTrainList(true);
        } else {
            setShowTrainList(false);
            // Mirror Flutter: reset map to KL overview when closing
            setSelectedTripId(null);
            setResetMapTrigger(t => t + 1);
            onClearSelection?.();
        }
    };

    // ── Selection handlers ─────────────────────────────────────────────────

    /** Desktop sidebar row click — pan map + open TripTracker */
    const handleSidebarSelect = (tripId: string) => {
        setSelectedTripId(tripId);
        setPanToTripId(tripId);
        onSelectTrip?.(tripId);
    };

    /** Mobile carousel card tap — open TripTracker (map already panned by scroll) */
    const handleCardTap = (v: VehiclePosition, index: number) => {
        // If tapping a non-active card, snap to it first
        if (index !== carouselIndexRef.current) {
            setCarouselIndex(index);
            carouselIndexRef.current = index;
        }
        setSelectedTripId(v.vehicle.trip.tripId);
        onSelectTrip?.(v.vehicle.trip.tripId);
    };

    /** Map marker click */
    const handleMarkerClick = (tripId: string) => {
        setSelectedTripId(tripId);
        onSelectTrip?.(tripId);
    };

    // ── Derived values ─────────────────────────────────────────────────────

    const getTrainNumber = (tripId: string) => {
        const parts = tripId.split('_');
        return parts.length > 1 ? parts.slice(1).join('_') : tripId;
    };

    const center: [number, number] = [3.140853, 101.693207];
    const focusedVehicle = focusTripId ? vehicles.find(v => v.vehicle.trip.tripId === focusTripId) : null;

    const displayRoutes = tripOnly && focusedVehicle
        ? routeShapes.filter(r => r.gtfsRouteId === focusedVehicle.vehicle.trip.routeId)
        : routeShapes;
    const displayVehicles = tripOnly
        ? vehicles.filter(v => focusTripId && v.vehicle.trip.tripId === focusTripId)
        : vehicles;

    // The "focused" marker is whichever trip is actively highlighted
    const highlightedTripId = selectedTripId ?? focusTripId;

    // Map height classes — shared between map div and sidebar so they match
    const mapHeightCls = tripOnly ? 'h-[400px]' : 'h-[calc(100vh-250px)] min-h-[500px]';

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">

            {/* Focused train banner (URL-param mode only) */}
            {!tripOnly && focusTripId && (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                        </span>
                        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                            Tracking Train {getTrainNumber(focusTripId)}
                        </span>
                        {focusedVehicle && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                · {getStatusText(focusedVehicle)}
                            </span>
                        )}
                    </div>
                    {onClearFocus && (
                        <button onClick={onClearFocus} className="p-1 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-700 dark:text-emerald-300 transition-colors">
                            <X size={16} />
                        </button>
                    )}
                </div>
            )}

            {/* Stats bar */}
            {!tripOnly && (
                <div className="flex flex-wrap gap-3 items-center justify-between bg-white dark:bg-white/5 dark:backdrop-blur-md p-4 rounded-xl shadow-sm border border-gray-100 dark:border-white/10 transition-colors">
                    <button
                        onClick={handleToggleTrainList}
                        aria-expanded={showTrainList}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                            showTrainList
                                ? 'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-200 dark:shadow-blue-900/40'
                                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                        }`}
                    >
                        <span className="relative flex h-2.5 w-2.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${showTrainList ? 'bg-white' : 'bg-blue-400'}`} />
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${showTrainList ? 'bg-white' : 'bg-blue-500'}`} />
                        </span>
                        {vehicles.length} Active Trains
                        <ChevronDown size={13} className={`transition-transform duration-200 ${showTrainList ? 'rotate-180' : ''}`} />
                    </button>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium bg-gray-50 dark:bg-white/10 px-3 py-1.5 rounded-full border border-gray-100 dark:border-white/5 transition-colors">
                        Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '...'}
                    </div>
                </div>
            )}

            {/* Route legend */}
            {!tripOnly && routeShapes.length > 0 && (
                <div className="space-y-2">
                    <button
                        onClick={() => setLegendOpen(p => !p)}
                        className="sm:hidden flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-white/5 px-3 py-1.5 rounded-full border border-gray-100 dark:border-white/10 shadow-sm"
                    >
                        Route Legend
                        <ChevronDown size={12} className={`transition-transform duration-200 ${legendOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`flex-wrap gap-2 px-1 ${legendOpen ? 'flex' : 'hidden'} sm:flex`}>
                        {routeShapes.map((r, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                                <span className="inline-block w-4 h-1 rounded-full" style={{ backgroundColor: r.color }} />
                                {r.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/*
             * ── Layout: [Sidebar (desktop)] + [Map + mobile carousel] ──────────
             *
             * Desktop: sidebar is a flex sibling so it sits alongside the map
             *          without stealing any map canvas space (the map just shrinks
             *          into the remaining flex-1 column).
             *
             * Mobile:  sidebar is hidden; carousel overlays the bottom ~120px of
             *          the map using absolute positioning so the map stays visible.
             */}
            <div className="flex gap-3 items-start">

                {/* ── DESKTOP: sidebar (flex sibling, does NOT overlay map) ──── */}
                {!tripOnly && showTrainList && (
                    <aside
                        className={`hidden lg:flex flex-col flex-shrink-0 w-[268px] ${mapHeightCls} bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden animate-fade-in`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                                </span>
                                <span className="text-sm font-bold text-gray-900 dark:text-white">{vehicles.length} Active Trains</span>
                            </div>
                            <button
                                onClick={handleToggleTrainList}
                                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                aria-label="Close train list"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {/* Scrollable train list — click once to switch, panel stays open */}
                        <div className="overflow-y-auto flex-1 p-2 space-y-0.5 scrollbar-hide">
                            {vehicles.length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-8">No active trains</p>
                            )}
                            {vehicles.map((v) => {
                                const tid = v.vehicle.trip.tripId;
                                const label = v.vehicle.vehicle.label || v.vehicle.vehicle.id;
                                const speed = v.vehicle.position?.speed ?? 0;
                                const moving = speed > 0;
                                const active = highlightedTripId === tid;
                                return (
                                    <button
                                        key={v.id}
                                        onClick={() => handleSidebarSelect(tid)}
                                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                                            active ? 'bg-blue-600' : 'hover:bg-gray-100 dark:hover:bg-white/[0.07]'
                                        }`}
                                    >
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                                            active ? 'bg-white/20' : moving ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-amber-100 dark:bg-amber-900/40'
                                        }`}>
                                            <Train size={14} className={active ? 'text-white' : moving ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-semibold truncate ${active ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                                Train {label}
                                            </div>
                                            <div className={`text-xs truncate ${active ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {getStatusText(v)}
                                            </div>
                                        </div>
                                        <div className={`flex-shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                                            active ? 'bg-white/20 text-white'
                                            : moving ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                                        }`}>
                                            <Zap size={9} />{speed.toFixed(0)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>
                )}

                {/* ── Map + mobile carousel ──────────────────────────────────── */}
                <div className="flex-1 min-w-0 relative">

                    {/* Map */}
                    <div className={`${mapHeightCls} w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-white/10 relative z-0 transition-colors`}>
                        <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                url={isDark
                                    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                                    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'}
                            />
                            <MapFocuser vehicles={displayVehicles} focusTripId={focusTripId} />
                            <MapPanner vehicles={vehicles} tripId={panToTripId} />
                            <MapResetter trigger={resetMapTrigger} />

                            {/* Route polylines */}
                            {displayRoutes.map((r, i) => (
                                <Polyline key={`track-${i}`} positions={r.coordinates} pathOptions={{ color: r.color, weight: 3, opacity: 0.7 }} />
                            ))}

                            {/* Station dots */}
                            {displayRoutes.map((r, ri) =>
                                r.stations.map((s, si) => (
                                    <CircleMarker
                                        key={`stn-${ri}-${si}`}
                                        center={[s.lat, s.lon]}
                                        radius={3}
                                        pathOptions={{ color: r.color, fillColor: isDark ? '#1e293b' : '#ffffff', fillOpacity: 1, weight: 2 }}
                                    >
                                        <Tooltip direction="top" offset={[0, -5]}>
                                            <span className="text-xs font-medium">{s.name}</span>
                                        </Tooltip>
                                    </CircleMarker>
                                ))
                            )}

                            {/* Train markers */}
                            {displayVehicles.map((v) => {
                                const isFocused = highlightedTripId && v.vehicle.trip.tripId === highlightedTripId;
                                const isDimmed = highlightedTripId && !isFocused;
                                return v.vehicle.position && (
                                    <Marker
                                        key={v.id}
                                        position={[v.vehicle.position.latitude, v.vehicle.position.longitude]}
                                        icon={L.divIcon({
                                            className: 'custom-icon',
                                            html: isFocused ? '<div class="focused-marker"></div>' : `<div class="blinking-marker${isDimmed ? ' dimmed-marker' : ''}"></div>`,
                                            iconSize: isFocused ? [28, 28] : [20, 20],
                                            iconAnchor: isFocused ? [14, 14] : [10, 10],
                                        })}
                                        zIndexOffset={isFocused ? 1000 : 0}
                                        eventHandlers={onSelectTrip ? { click: () => handleMarkerClick(v.vehicle.trip.tripId) } : undefined}
                                    >
                                        <Popup>
                                            <div className="p-2">
                                                <h3 className="font-bold text-lg mb-1 text-gray-900">Train {v.vehicle.vehicle.label || v.vehicle.vehicle.id}</h3>
                                                <div className="space-y-1 text-sm text-gray-700">
                                                    <p><span className="font-semibold">Status:</span> {getStatusText(v)}</p>
                                                    <p><span className="font-semibold">Speed:</span> {v.vehicle.position.speed?.toFixed(1) || 0} km/h</p>
                                                    <p><span className="font-semibold">Updated:</span> {(() => {
                                                        const d = new Date(v.vehicle.timestamp * 1000);
                                                        return isNaN(d.getTime()) ? 'Unknown' : d.toLocaleTimeString();
                                                    })()}</p>
                                                </div>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>
                    </div>

                    {/*
                     * ── MOBILE: snap-scroll carousel overlaying map bottom ─────
                     *
                     * Mirrors Flutter's PageView(viewportFraction: 0.85):
                     *  - Each card is 85% of the container width
                     *  - 7.5% padding on each side lets ~7% of adjacent cards peek in
                     *  - scroll-snap-type: x mandatory → one card snaps at a time
                     *  - Swiping to a new card → map pans to that train (via carouselIndex effect)
                     *  - Tapping a card → opens TripTracker bottom sheet (via onSelectTrip)
                     *  - Closing → map resets to KL overview (via MapResetter)
                     */}
                    {!tripOnly && showTrainList && (
                        <div className="lg:hidden absolute bottom-0 left-0 right-0 z-10">

                            {/* Dark gradient: map fades into the cards */}
                            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent to-black/40 pointer-events-none" />

                            {/* Cards strip */}
                            <div className="relative pt-4 pb-4 bg-black/40 backdrop-blur-[2px]">

                                {/* Micro-header: hint + close */}
                                <div className="flex items-center px-4 mb-2">
                                    <span className="text-[11px] font-medium text-white/55 flex-1 tracking-wide uppercase">
                                        Swipe · tap to track
                                    </span>
                                    <button
                                        onClick={handleToggleTrainList}
                                        className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                                        aria-label="Close carousel"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                {/*
                                 * Snap carousel.
                                 * paddingLeft/Right of 7.5% lets adjacent cards peek.
                                 * Each card wrapper is 85% wide with scroll-snap-align: center.
                                 */}
                                <div
                                    ref={carouselRef}
                                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                                    style={{ paddingLeft: '7.5%', paddingRight: '7.5%', gap: '10px' }}
                                    onScroll={handleCarouselScroll}
                                >
                                    {vehicles.length === 0 && (
                                        <p className="text-xs text-white/50 py-2 px-4">No active trains</p>
                                    )}
                                    {vehicles.map((v, index) => {
                                        const tid = v.vehicle.trip.tripId;
                                        const label = v.vehicle.vehicle.label || v.vehicle.vehicle.id;
                                        const speed = v.vehicle.position?.speed ?? 0;
                                        const moving = speed > 0;
                                        const isActive = index === carouselIndex;

                                        return (
                                            /* Card wrapper — sets snap behaviour */
                                            <div
                                                key={v.id}
                                                data-ci={index}
                                                className="flex-shrink-0 snap-center transition-all duration-200"
                                                style={{
                                                    width: '85%',
                                                    transform: isActive ? 'scale(1)' : 'scale(0.94)',
                                                }}
                                            >
                                                <button
                                                    onClick={() => handleCardTap(v, index)}
                                                    className={`w-full p-4 rounded-2xl transition-all duration-200 text-left ${
                                                        isActive
                                                            ? 'bg-white dark:bg-slate-800 shadow-xl border-2 border-blue-500'
                                                            : 'bg-white/88 dark:bg-slate-800/88 border-2 border-transparent shadow-md'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {/* Icon */}
                                                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                                                            moving ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-amber-100 dark:bg-amber-900/40'
                                                        }`}>
                                                            <Train size={18} className={moving ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'} />
                                                        </div>
                                                        {/* Label + status */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                                Train {label}
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                                {getStatusText(v)}
                                                            </div>
                                                        </div>
                                                        {/* Speed badge */}
                                                        <div className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full ${
                                                            moving
                                                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                                                : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                                                        }`}>
                                                            <Zap size={10} />
                                                            {speed.toFixed(0)} km/h
                                                        </div>
                                                    </div>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>{/* end map wrapper */}
            </div>{/* end flex row */}
        </div>
    );
}
