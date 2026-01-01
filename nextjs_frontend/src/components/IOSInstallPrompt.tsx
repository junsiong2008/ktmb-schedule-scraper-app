"use client";

import { useState, useEffect } from "react";
import { Share, X } from "lucide-react";

export default function IOSInstallPrompt() {
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if user is on iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);

        // Check if app is in standalone mode (PWA installed)
        const isStandaloneMode =
            (window.navigator as any).standalone === true ||
            window.matchMedia("(display-mode: standalone)").matches;

        setIsIOS(isIosDevice);
        setIsStandalone(isStandaloneMode);

        // Show prompt only if on iOS and not standalone
        if (isIosDevice && !isStandaloneMode) {
            // Show after a short delay
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    if (!isIOS || isStandalone || !isVisible) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-8 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in slide-in-from-bottom duration-500">
            <div className="max-w-md mx-auto relative">
                <button
                    onClick={() => setIsVisible(false)}
                    className="absolute -top-2 -right-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    aria-label="Close install prompt"
                >
                    <X size={16} />
                </button>

                <div className="flex items-start gap-4">
                    <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl shrink-0">
                        <Share className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                            Install App
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug">
                            Install this application on your home screen for quick and easy access.
                        </p>
                        <div className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                            <span>Tap</span>
                            {/* iOS generic share icon representation */}
                            <Share size={16} className="inline" />
                            <span>then &quot;Add to Home Screen&quot; +</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
