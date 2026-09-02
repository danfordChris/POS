import { getSession } from '@/lib/session';
import { Forbidden } from '@/components/shell/Forbidden';
import { StubPage } from '@/components/shell/StubPage';

export default async function SupportPage() {
  const session = await getSession();
  if (session?.role !== 'owner') return <Forbidden />;
  return (
    <StubPage
      title="Support"
      subtitle="Review and approve operator break-glass access."
      task="Phase 06"
    />
  );
}
