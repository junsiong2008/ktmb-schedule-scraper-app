'use client';

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import TripTracker from '@/components/TripTracker';

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

function LivePageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const focusTripId = searchParams.get('trip');
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

    const handleClearFocus = () => {
        router.replace('/live');
    };

    // The trip shown in the tracker: URL param takes precedence, then map selection
    const activeTripId = focusTripId || selectedTripId;

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-950 dark:to-slate-900 font-[family-name:var(--font-geist-sans)] transition-colors">
            <Header />

            <div className={`mx-auto p-4 md:p-8 ${!focusTripId && selectedTripId ? 'max-w-7xl' : 'max-w-4xl'} transition-all`}>
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

                <div className={`${!focusTripId && selectedTripId ? 'lg:flex-row lg:gap-6' : ''} flex flex-col`}>
                    <div className={`${!focusTripId && selectedTripId ? 'lg:flex-1 min-w-0' : ''}`}>
                        <LiveMap
                            focusTripId={focusTripId}
                            onClearFocus={handleClearFocus}
                            tripOnly={!!focusTripId}
                            onSelectTrip={!focusTripId ? setSelectedTripId : undefined}
                            onClearSelection={!focusTripId ? () => setSelectedTripId(null) : undefined}
                        />
                    </div>

                    {/* Large screens: side panel */}
                    {!focusTripId && selectedTripId && (
                        <div className="hidden lg:block lg:w-[340px] lg:flex-shrink-0">
                            <TripTracker
                                tripId={selectedTripId}
                                onBack={() => setSelectedTripId(null)}
                            />
                        </div>
                    )}
                </div>

                {/* Small screens: bottom sheet overlay */}
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