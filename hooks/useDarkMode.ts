import { useState, useEffect } from 'react';

export function useDarkMode(): [boolean, () => void] {
  // Read current state from the DOM — index.html already applied it
  const [isDark, setIsDark] = useState<boolean>(
    () => document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try { localStorage.setItem('pagekin_dark', String(isDark)); } catch { /* ignore */ }
  }, [isDark]);

  return [isDark, () => setIsDark(d => !d)];
}