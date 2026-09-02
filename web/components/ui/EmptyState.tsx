import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from './Button';
import { Card } from './Surface';

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

/** Illustration-style empty state: icon chip + headline + one line + one CTA. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-pill bg-surface-sunken text-text-secondary shadow-elev-inset [&_svg]:h-7 [&_svg]:w-7">
        {icon}
      </span>
      <h3 className="text-h3 font-semibold text-text-primary">{title}</h3>
      {description ? <p className="max-w-sm text-body text-text-secondary">{description}</p> : null}
      {action ? (
        <div className="mt-1">
          {action.href ? (
            <Link href={action.href}>
              <Button variant="primary">{action.label}</Button>
            </Link>
          ) : (
            <Button variant="primary" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}
