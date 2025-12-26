import React from 'react';
import { NextTrain } from '@/services/api';
import { Clock, Train, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface NextTrainCardProps {
    nextTrain: NextTrain | null;
    isLoading: boolean;
}

export default function NextTrainCard({ nextTrain, isLoading }: NextTrainCardProps) {
    if (isLoading) {
        return (
            <div className="w-full max-w-md mx-auto mt-8 animate-pulse">
                <div className="h-48 bg-gray-200 rounded-2xl"></div>
            </div>
        );
    }

    if (!nextTrain) {
        return (
            <div className="w-full max-w-md mx-auto mt-8 p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <p>No upcoming trains found for this route.</p>
            </div>
        );
    }

    // Parse times (assuming HH:mm:ss format from API, might need date context if it crosses midnight)
    // For now, just displaying the raw time string or formatting if it's ISO
    const formatTime = (timeStr: string) => {
        try {
            // If it's just HH:mm:ss, return as is or add dummy date to format
            if (timeStr.length === 8) return timeStr.substring(0, 5);
            return format(parseISO(timeStr), 'HH:mm');
        } catch (e) {
            return timeStr;
        }
    };

    return (
        <div className="w-full max-w-md mx-auto mt-8 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity duration-500"></div>
            <div className="relative bg-white rounded-2xl p-6 shadow-xl border border-gray-100 overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Train size={120} />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider">
                            Next Train
                        </span>
                        <span className="text-gray-400 text-sm font-medium">
                            {nextTrain.trip_id}
                        </span>
                    </div>

                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="text-5xl font-black text-gray-900 tracking-tight mb-2">
                            {formatTime(nextTrain.departure_time)}
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 font-medium mb-4">
                            <Clock size={16} />
                            <span>Departure Time</span>
                        </div>

                        <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-2 duration-700 delay-150">
                            <div className="h-4 w-px bg-gray-200 mb-2"></div>
                            <div className="bg-gray-50 px-4 py-2 rounded-full border border-gray-100 flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Arrives</span>
                                <span className="text-lg font-bold text-gray-700">{formatTime(nextTrain.arrival_time)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-gray-600">
                                    <Train size={18} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">Route</p>
                                    <p className="text-sm font-semibold text-gray-900">{nextTrain.route_long_name}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-gray-600">
                                    <ArrowRight size={18} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">Direction</p>
                                    <p className="text-sm font-semibold text-gray-900">{nextTrain.trip_headsign}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
