'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'migration_banner_dismissed';

export default function MigrationBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (
      window.location.hostname !== 'nextstop.jsdevexperiment.my' &&
      !sessionStorage.getItem(STORAGE_KEY)
    ) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="w-full bg-amber-500 text-amber-950 text-sm px-4 py-2 flex items-center gap-3">
      <span className="flex-1 text-center">
        We&apos;ve moved to a new domain!{' '}
        <a
          href="https://nextstop.jsdevexperiment.my"
          className="underline font-semibold hover:opacity-80"
        >
          nextstop.jsdevexperiment.my
        </a>{' '}
        — please update your bookmarks.
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss banner"
        className="shrink-0 p-0.5 rounded hover:bg-amber-600/30 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
