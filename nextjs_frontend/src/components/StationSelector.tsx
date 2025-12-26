import React from 'react';
import { Station } from '@/services/api';
import { MapPin, ArrowRight } from 'lucide-react';

interface StationSelectorProps {
    stations: Station[];
    originId: string;
    destinationId: string;
    onOriginChange: (id: string) => void;
    onDestinationChange: (id: string) => void;
}

export default function StationSelector({
    stations,
    originId,
    destinationId,
    onOriginChange,
    onDestinationChange,
}: StationSelectorProps) {
    return (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-white/20 w-full max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative w-full group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors">
                        <MapPin size={20} />
                    </div>
                    <select
                        value={originId}
                        onChange={(e) => onOriginChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none text-gray-700 font-medium cursor-pointer hover:bg-gray-100"
                    >
                        <option value="" disabled>Select Origin</option>
                        {stations.map((station) => (
                            <option key={station.station_id} value={station.station_id}>
                                {station.station_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="text-gray-400">
                    <ArrowRight size={24} className="hidden md:block" />
                    <ArrowRight size={24} className="md:hidden rotate-90" />
                </div>

                <div className="relative w-full group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors">
                        <MapPin size={20} />
                    </div>
                    <select
                        value={destinationId}
                        onChange={(e) => onDestinationChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none text-gray-700 font-medium cursor-pointer hover:bg-gray-100"
                    >
                        <option value="" disabled>Select Destination</option>
                        {stations.map((station) => (
                            <option key={station.station_id} value={station.station_id}>
                                {station.station_name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
