'use client';

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import TripTracker from '@/components/TripTracker';
import { Train, Zap, X } from 'lucide-react';
import type { VehiclePosition } from '../../components/LiveMap';

// Dynamically import the map component with no SSR
const LiveMap = dynamic(() => import('../../components/LiveMap'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-[600px] bg-gray-100 dark:bg-zinc-800 rounded-lg animate-pulse transition-colors">
            <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-gray-500 dark:text-gray-400 font-medium">Loading Map...</div>
            </div>
        </div>
    ),
});

// Inlined here to avoid importing LiveMap.tsx at page level (would pull in Leaflet during SSR)
function getStatusText(v: VehiclePosition): string {
    const { currentStatus: s, stopId } = v.vehicle;
    if (s === 0) return stopId ? `Incoming · ${stopId}` : 'Arriving';
    if (s === 1) return stopId ? `Stopped · ${stopId}` : 'Stopped';
    if (s === 2) return 'In Transit';
    return 'Unknown';
}

function LivePageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const focusTripId = searchParams.get('trip');

    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
    const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
    const [showTrainList, setShowTrainList] = useState(false);

    const handleClearFocus = () => {
        router.replace('/live');
    };

    const handleToggleTrainList = () => {
        if (showTrainList) {
            setSelectedTripId(null);
        }
        setShowTrainList(prev => !prev);
    };

    const activeTripId = focusTripId || selectedTripId;

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-950 dark:to-slate-900 font-[family-name:var(--font-geist-sans)] transition-colors">
            <Header />

            <div className={`mx-auto p-4 md:p-8 transition-all duration-200 ${!focusTripId && showTrainList ? 'max-w-[1200px]' : 'max-w-4xl'}`}>
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        Live Train Tracking
                        <span className="bg-yellow-400 text-blue-900 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Beta</span>
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {activeTripId ? 'Real-time position of your train.' : 'Real-time positions of KTMB trains across the network.'}
                    </p>
                </div>

                {focusTripId && (
                    <div className="mb-6">
                        <TripTracker
                            tripId={focusTripId}
                            onBack={() => router.back()}
                        />
                    </div>
                )}

                {/* Page-level flex row: left panel (desktop) + LiveMap column + right TripTracker panel (desktop) */}
                <div className="flex items-start gap-4">

                    {/* Left panel: train list (desktop only, when list open) */}
                    {!focusTripId && showTrainList && (
                        <aside className="hidden lg:flex flex-col w-[320px] flex-shrink-0 sticky top-4 max-h-[calc(100vh-6rem)] animate-fade-in">

                            {/* Train list panel */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg overflow-hidden flex flex-col flex-1 min-h-0">
                                {/* Panel header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                                        </span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {vehicles.length} Active Trains
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleToggleTrainList}
                                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                        aria-label="Close panel"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Train list — scrollable */}
                                <div className="overflow-y-auto scrollbar-hide flex-1">
                                    {vehicles.length === 0 ? (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 py-4 px-4">No active trains found.</p>
                                    ) : (
                                        <div className="p-2 space-y-1">
                                            {vehicles.map(v => {
                                                const tripParts = v.vehicle.trip.tripId.split('_');
                                                const trainNumber = tripParts.length > 1 ? tripParts.slice(1).join('_') : v.vehicle.trip.tripId;
                                                const label = v.vehicle.vehicle.label || v.vehicle.vehicle.id;
                                                const speed = v.vehicle.position?.speed ?? 0;
                                                const moving = speed > 0;
                                                const isSelected = v.vehicle.trip.tripId === selectedTripId;
                                                return (
                                                    <button
                                                        key={v.id}
                                                        ref={isSelected ? (el) => { el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } : undefined}
                                                        onClick={() => setSelectedTripId(v.vehicle.trip.tripId)}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${isSelected
                                                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                                                            : 'hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent'
                                                            }`}
                                                    >
                                                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${moving ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-amber-100 dark:bg-amber-900/40'}`}>
                                                            <Train size={15} className={moving ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-semibold text-gray-900 dark:text-white">{trainNumber}</div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                                Train {label} &bull; {getStatusText(v)}
                                                            </div>
                                                        </div>
                                                        <div className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${moving ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'}`}>
                                                            <Zap size={9} />{speed.toFixed(0)}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </aside>
                    )}

                    {/* LiveMap column — always flex-1 so panels can sit beside it */}
                    <div className="flex-1 min-w-0">
                        <LiveMap
                            focusTripId={focusTripId}
                            onClearFocus={handleClearFocus}
                            tripOnly={!!focusTripId}
                            selectedTripId={!focusTripId ? selectedTripId : null}
                            onSelectTrip={!focusTripId ? setSelectedTripId : undefined}
                            showTrainList={!focusTripId ? showTrainList : false}
                            onToggleTrainList={!focusTripId ? handleToggleTrainList : undefined}
                            onVehiclesUpdate={!focusTripId ? setVehicles : undefined}
                        />
                    </div>

                    {/* Right panel: TripTracker (desktop only, when a train is selected) */}
                    {!focusTripId && showTrainList && selectedTripId && (
                        <aside className="hidden lg:flex flex-col w-[320px] flex-shrink-0 sticky top-4 max-h-[calc(100vh-6rem)] animate-fade-in">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                                <TripTracker
                                    tripId={selectedTripId}
                                    onBack={() => setSelectedTripId(null)}
                                />
                            </div>
                        </aside>
                    )}
                </div>

                {/* Mobile: TripTracker bottom sheet overlay */}
                {!focusTripId && selectedTripId && (
                    <div className="lg:hidden fixed inset-0 z-50">
                        {/* Backdrop scrim */}
                        <div
                            className="absolute inset-0 bg-black/40"
                            onClick={() => setSelectedTripId(null)}
                        />
                        {/* Sheet */}
                        <div className="absolute bottom-0 left-0 right-0 max-h-[60vh] bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl animate-slide-up flex flex-col">
                            {/* Drag handle + close */}
                            <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0">
                                <div className="flex-1" />
                                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                                <div className="flex-1 flex justify-end">
                                    <button
                                        onClick={() => setSelectedTripId(null)}
                                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                        aria-label="Close"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            {/* Scrollable content */}
                            <div className="overflow-y-auto px-4 pb-4">
                                <TripTracker
                                    tripId={selectedTripId}
                                    onBack={() => setSelectedTripId(null)}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function LivePage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-950 dark:to-slate-900 font-[family-name:var(--font-geist-sans)] transition-colors">
                <Header />
                <div className="max-w-4xl mx-auto p-4 md:p-8">
                    <div className="flex items-center justify-center h-[600px] bg-gray-100 dark:bg-zinc-800 rounded-lg animate-pulse transition-colors">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <div className="text-gray-500 dark:text-gray-400 font-medium">Loading...</div>
                        </div>
                    </div>
                </div>
            </main>
        }>
            <LivePageContent />
        </Suspense>
    );
}
