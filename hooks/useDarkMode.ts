import { useState, useEffect } from 'react';

export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pagekin_dark');
      if (saved !== null) return saved === 'true';
    } catch { /* ignore */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try { localStorage.setItem('pagekin_dark', String(isDark)); } catch { /* ignore */ }
  }, [isDark]);

  return [isDark, () => setIsDark(d => !d)];
}