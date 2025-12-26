import React from 'react';
import { ScheduleItem } from '@/services/api';
import { Clock } from 'lucide-react';

interface ScheduleListProps {
    schedule: ScheduleItem[];
    isLoading: boolean;
}

export default function ScheduleList({ schedule, isLoading }: ScheduleListProps) {
    if (isLoading) {
        return (
            <div className="w-full max-w-3xl mx-auto mt-12 space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"></div>
                ))}
            </div>
        );
    }

    if (schedule.length === 0) {
        return null;
    }

    // Group by trip_headsign
    const groupedSchedule = schedule.reduce((acc, item) => {
        const headsign = item.trip_headsign || 'Unknown Direction';
        if (!acc[headsign]) {
            acc[headsign] = [];
        }
        acc[headsign].push(item);
        return acc;
    }, {} as Record<string, ScheduleItem[]>);

    return (
        <div className="w-full max-w-3xl mx-auto mt-12 space-y-8">
            {Object.entries(groupedSchedule).map(([headsign, items]) => (
                <div key={headsign}>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 px-2 flex items-center gap-2">
                        <Clock size={20} className="text-blue-600" />
                        To {headsign}
                    </h3>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="divide-y divide-gray-100">
                            {items.map((item, index) => (
                                <div
                                    key={`${item.trip_id}-${index}`}
                                    className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            {item.trip_id}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-gray-900">{item.arrival_time.substring(0, 5)}</p>
                                            <p className="text-xs text-gray-500">Arrival</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
