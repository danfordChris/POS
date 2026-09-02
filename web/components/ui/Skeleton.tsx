import { cn } from './cn';

/** A sunken shimmer block. Compose these for list/table loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block rounded-control bg-surface-sunken shadow-elev-inset',
        'relative overflow-hidden',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite]',
        'before:bg-gradient-to-r before:from-transparent before:via-surface/60 before:to-transparent',
        className,
      )}
    />
  );
}

/** N stacked text lines. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** A placeholder table body — `rows` × `cols` cells inside a card. */
export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-card bg-surface p-4 shadow-elev-md">
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn('h-4', c === 0 ? 'flex-[2]' : 'flex-1')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
