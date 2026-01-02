"use client";

import Link from "next/link";
import { Train, Map } from "lucide-react";
import ClockComponent from "@/components/Clock";

interface HeaderProps {
    onLogoClick?: () => void;
    showLiveMap?: boolean;
}

export function Header({ onLogoClick, showLiveMap = false }: HeaderProps) {
    const LogoContent = (
        <div className={`flex items-center gap-2 md:gap-3 cursor-pointer ${!onLogoClick ? 'hover:opacity-90 transition-opacity' : ''}`}>
            <div className="p-1.5 md:p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <Train className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight">Next Stop</h1>
        </div>
    );

    return (
        <header className="bg-blue-600 dark:bg-slate-900/90 dark:backdrop-blur-md text-white p-4 md:p-6 shadow-lg sticky top-0 z-50 transition-colors border-b border-blue-500/20 dark:border-slate-800">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
                {onLogoClick ? (
                    <div onClick={onLogoClick}>{LogoContent}</div>
                ) : (
                    <Link href="/">{LogoContent}</Link>
                )}

                <div className="flex items-center gap-2 md:gap-3">
                    {showLiveMap && (
                        <Link
                            href="/live"
                            className="flex items-center gap-2 px-2 py-1.5 md:px-3 md:py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs md:text-sm font-medium"
                        >
                            <Map className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                            <span className="hidden sm:inline">Live Map</span>
                            <span className="bg-yellow-400 text-blue-900 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Beta
                            </span>
                        </Link>
                    )}
                    <ClockComponent />
                </div>
            </div>
        </header>
    );
}
