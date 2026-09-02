import { getSession } from '@/lib/session';
import { Forbidden } from '@/components/shell/Forbidden';
import { StubPage } from '@/components/shell/StubPage';

export default async function AlertsPage() {
  const session = await getSession();
  if (session?.role !== 'owner') return <Forbidden />;
  return (
    <StubPage title="Alerts" subtitle="Low-stock alert recipients and interval." task="Phase 03" />
  );
}
