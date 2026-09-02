import { ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui';

/** Rendered in place of an Owner-only route's content for Staff. */
export function Forbidden() {
  return (
    <Card className="flex flex-col items-center gap-3 text-center max-w-md mx-auto mt-12">
      <ShieldAlert size={32} strokeWidth={2} className="text-danger" />
      <h1 className="text-h2 font-bold">Owner access required</h1>
      <p className="text-body text-text-secondary">
        This section is limited to business Owners. Ask an Owner if you need access.
      </p>
      <p className="text-overline uppercase tracking-wide text-text-disabled">role_forbidden</p>
    </Card>
  );
}
