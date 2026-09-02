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
  /** The user's stored choice. `system` follows the OS. */
  preference: ThemePreference;
  /** The theme actually applied right now. */
  resolved: ThemeMode;
  setPreference: (next: ThemePreference) => void;
  /** Cycle light → dark → system. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Blocking snippet injected in <head> so the stored theme is on <html data-theme>
 * before first paint — no flash of the wrong palette. Keep in sync with
 * `resolvePreference` / `systemMode` below.
 */
export const themeInitScript = `(function () {
  try {
    var p = localStorage.getItem('${STORAGE_KEY}');
    var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var mode = p === 'light' || p === 'dark' ? p : (sysDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', mode);
  } catch (e) {}
})();`;

function resolvePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const p = localStorage.getItem(STORAGE_KEY);
    if (p === 'light' || p === 'dark' || p === 'system') return p;
  } catch {
    /* private mode / storage disabled */
  }
  return 'system';
}

function systemMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function persist(next: ThemePreference): void {
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore persistence failure */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initialisers are SSR-safe (return the light/system defaults on the
  // server) and read the real values on the client's first render.
  const [preference, setPreferenceState] = useState<ThemePreference>(resolvePreference);
  const [system, setSystem] = useState<ThemeMode>(systemMode);

  // Follow OS changes while the preference is `system`.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: ThemeMode = preference === 'system' ? system : preference;

  // Reflect the resolved theme onto <html> (not React state — safe in an effect).
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
