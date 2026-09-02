import { getSession } from '@/lib/session';
import { Forbidden } from '@/components/shell/Forbidden';
import { StubPage } from '@/components/shell/StubPage';

export default async function ReportsPage() {
  const session = await getSession();
  if (session?.role !== 'owner') return <Forbidden />;
  return <StubPage title="Reports" subtitle="Sales, top products, stock value." task="Phase 06" />;
}
