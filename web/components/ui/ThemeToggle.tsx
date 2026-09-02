'use client';

import { useTheme, type ThemePreference } from '@/lib/theme';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
];

/** Light / Dark / Auto switch bound to the ThemeProvider. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl
      aria-label="Theme"
      options={OPTIONS}
      value={preference}
      onChange={setPreference}
    />
  );
}
