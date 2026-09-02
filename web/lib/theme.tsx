'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

const STORAGE_KEY = 'duka-theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ThemeMode;
  setPreference: (next: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Blocking snippet injected in <head> so the stored theme is on <html data-theme>
 * before first paint — no flash of the wrong palette.
 */
export const themeInitScript = `(function () {
  try {
    var p = localStorage.getItem('${STORAGE_KEY}');
    var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var mode = p === 'light' || p === 'dark' ? p : (sysDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', mode);
  } catch (e) {}
})();`;

function readStored(): ThemePreference {
  try {
    const p = localStorage.getItem(STORAGE_KEY);
    if (p === 'light' || p === 'dark' || p === 'system') return p;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

function systemMode(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function persist(next: ThemePreference): void {
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Deterministic defaults so SSR and the client's first render agree; the real
  // values are read after mount (below), avoiding a hydration mismatch.
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [system, setSystem] = useState<ThemeMode>('light');

  useEffect(() => {
    // One-shot hydration of the stored preference + OS setting after mount.
    const hydrate = () => {
      setPreferenceState(readStored());
      setSystem(systemMode());
    };
    hydrate();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: ThemeMode = preference === 'system' ? system : preference;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    persist(next);
  }, []);

  const toggle = useCallback(() => {
    setPreferenceState((prev) => {
      const order: ThemePreference[] = ['light', 'dark', 'system'];
      const next = order[(order.indexOf(prev) + 1) % order.length];
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
