import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const byTone: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-text-secondary shadow-elev-inset',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  accent: 'bg-accent/15 text-accent',
};

/** Small status pill. Tinted for semantic tones; a sunken well for neutral. */
export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2 py-0.5 text-overline font-semibold uppercase tracking-wide',
        byTone[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
