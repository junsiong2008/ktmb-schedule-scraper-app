'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Train } from 'lucide-react';
import ClockComponent from '@/components/Clock';

// Dynamically import the map component with no SSR
const LiveMap = dynamic(() => import('../../components/LiveMap'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-[600px] bg-gray-100 rounded-lg animate-pulse">
            <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-gray-500 font-medium">Loading Map...</div>
            </div>
        </div>
    ),
});

export default function LivePage() {
    return (
        <main className="min-h-screen bg-gray-50 font-[family-name:var(--font-geist-sans)]">
            {/* Header */}
            <header className="bg-blue-600 text-white p-6 shadow-lg sticky top-0 z-50">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                            <Train size={24} />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">Next Stop</h1>
                    </Link>
                    <div className="flex items-center gap-3">
                        <ClockComponent />
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto p-4 md:p-8">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Live Train Tracking
                        <span className="bg-yellow-400 text-blue-900 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Beta</span>
                    </h2>
                    <p className="text-gray-600 mt-1">Real-time positions of KTMB trains across the network.</p>
                </div>

                <LiveMap />
            </div>
        </main>
    );
}
