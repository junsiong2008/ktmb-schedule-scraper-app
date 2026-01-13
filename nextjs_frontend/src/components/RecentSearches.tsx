import React from 'react';
import { Clock } from 'lucide-react';

export interface RecentSearchItem {
    id: string; // unique ID to help with key props
    originId: string;
    destinationId: string;
    originName: string;
    destinationName: string;
    serviceType: string;
    timestamp: number;
}

interface RecentSearchesProps {
    searches: RecentSearchItem[];
    onSelect: (search: RecentSearchItem) => void;
    className?: string;
}

export const RecentSearches: React.FC<RecentSearchesProps> = ({
    searches,
    onSelect,
    className = '',
}) => {
    if (searches.length === 0) return null;

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
                <Clock size={12} />
                <span>Recent Searches</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {searches.map((search) => (
                    <button
                        key={search.id}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelect(search);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium 
                     bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 
                     hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 
                     border border-gray-200 dark:border-white/10 transition-all active:scale-95"
                        title={`Search from ${search.originName} to ${search.destinationName}`}
                    >
                        <span>{search.originName}</span>
                        <span className="text-gray-400">→</span>
                        <span>{search.destinationName}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
