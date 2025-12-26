'use client';

import React, { useState, useEffect } from 'react';
import { Clock as ClockIcon } from 'lucide-react';

export default function Clock() {
    const [time, setTime] = useState<string>('');

    useEffect(() => {
        // Initialize time immediately on client side to avoid hydration mismatch
        // or just wait for first tick. To avoid hydration mismatch, we start empty or with a specific state
        // and update in useEffect.
        const updateTime = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString('en-US', {
                hour12: true,
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit'
            }));
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);

        return () => clearInterval(interval);
    }, []);

    if (!time) return null; // Prevent hydration mismatch by rendering nothing initially

    return (
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10 text-white text-sm font-medium shadow-sm">
            <ClockIcon size={14} className="text-blue-100" />
            <span className="tabular-nums tracking-wide">{time}</span>
        </div>
    );
}
