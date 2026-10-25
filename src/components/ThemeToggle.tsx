'use client';

import { useSyncExternalStore, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getThemeSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('theme');
  if (saved) return saved === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export default function ThemeToggle() {
  const isDarkFromStore = useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);
  const [overrideDark, setOverrideDark] = useState<boolean | null>(null);

  const isDark = overrideDark !== null ? overrideDark : isDarkFromStore;

  const toggleTheme = () => {
    const nextDark = !isDark;
    setOverrideDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <button
      id="theme-toggle-btn"
      onClick={toggleTheme}
      aria-label="Toggle Dark Mode"
      className="p-2 rounded-xl transition-all duration-200 border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm"
    >
      {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
    </button>
  );
}
