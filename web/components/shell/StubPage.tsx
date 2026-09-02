import type { ReactNode } from 'react';
import { Panel } from '@/components/ui';

/** Placeholder for a route whose screen ships in a later Phase 02 task. */
export function StubPage({
  title,
  subtitle,
  task,
  children,
}: {
  title: string;
  subtitle?: string;
  task: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-bold">{title}</h1>
        {subtitle ? <p className="text-body text-text-secondary mt-1">{subtitle}</p> : null}
      </div>
      <Panel title="Coming soon" subtitle={`This screen is built in ${task}.`}>
        <p className="text-body text-text-secondary">
          The app shell, auth, navigation, and design system are in place. The data views for this
          route land with {task}.
        </p>
        {children}
      </Panel>
    </div>
  );
}
