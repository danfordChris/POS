import { getSession } from '@/lib/session';
import { tenantGet } from '@/lib/tenant-api';
import { ApiError } from '@/lib/api';
import { Forbidden } from '@/components/shell/Forbidden';
import { ErrorCard } from '@/components/ui';
import { AlertConfigForm } from '@/components/alerts/AlertConfigForm';
import type { AlertConfig } from '@/lib/models';

export default async function AlertsPage() {
  const session = await getSession();
  if (session?.role !== 'owner') return <Forbidden />;

  let config: AlertConfig;
  try {
    config = await tenantGet<AlertConfig>('/alert-config');
  } catch (e) {
    const code = e instanceof ApiError ? e.code : 'unknown';
    const message = e instanceof ApiError ? e.message : 'Could not load alert settings.';
    return <ErrorCard code={code} title={message} />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-h2 font-bold">Low-stock alerts</h1>
        <p className="text-body text-text-secondary">
          Who gets the low-stock digest email, and how often at most.
        </p>
      </div>
      <AlertConfigForm initial={config} />
    </div>
  );
}
