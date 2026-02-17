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

            <div className="max-w-4xl mx-auto p-4 md:p-8">
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

                <LiveMap
                    focusTripId={focusTripId}
                    onClearFocus={handleClearFocus}
                    tripOnly={!!focusTripId}
                    onSelectTrip={!focusTripId ? setSelectedTripId : undefined}
                />

                {/* Route progress for a train selected from the map (not from URL) */}
                {!focusTripId && selectedTripId && (
                    <div className="mt-6">
                        <TripTracker
                            tripId={selectedTripId}
                            onBack={() => setSelectedTripId(null)}
                        />
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