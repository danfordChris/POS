import type { ReactNode } from 'react';
import { Card } from './Surface';
import { Button } from './Button';

export interface ErrorCardProps {
  /** Machine code from the API error envelope (`error.code`). */
  code: string;
  /** Plain-language, end-user-safe title. */
  title: string;
  /** Optional one-line elaboration — never a stack trace or `devMessage`. */
  body?: ReactNode;
  /** Exactly one recovery action. */
  action?: { label: string; onClick: () => void };
}

/**
 * The only sanctioned surface for a failed request. Pairs a human title with the
 * error code and a single action. Raw technical detail (`devMessage`, stacks) is
 * for logs, not this card.
 */
export function ErrorCard({ code, title, body, action }: ErrorCardProps) {
  return (
    <Card role="alert" className="border-l-4 border-danger flex flex-col gap-3">
      <div>
        <p className="text-h3 font-semibold text-text-primary">{title}</p>
        {body ? <p className="text-body text-text-secondary mt-1">{body}</p> : null}
        <p className="text-overline uppercase tracking-wide text-text-disabled mt-2">{code}</p>
      </div>
      {action ? (
        <div>
          <Button variant="secondary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
