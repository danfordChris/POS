import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/** Raised neumorphic container — one surface color, elevation via shadow only. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface rounded-card shadow-elev-md p-6 text-text-primary', className)}
      {...props}
    />
  );
}

/** Sunken well — used for anything that should read as recessed. */
export function Well({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-surface-sunken rounded-control shadow-elev-inset p-4 text-text-primary',
        className,
      )}
      {...props}
    />
  );
}

/** Card with a header row: title + optional subtitle + optional actions slot. */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('p-0', className)}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
        <div className="min-w-0">
          <h2 className="text-h3 font-semibold truncate">{title}</h2>
          {subtitle ? <p className="text-caption text-text-secondary mt-0.5">{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="px-6 pb-6">{children}</div>
    </Card>
  );
}
