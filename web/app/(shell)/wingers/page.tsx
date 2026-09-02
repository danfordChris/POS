import { getSession } from '@/lib/session';
import { Forbidden } from '@/components/shell/Forbidden';
import { StubPage } from '@/components/shell/StubPage';

export default async function WingersPage() {
  const session = await getSession();
  if (session?.role !== 'owner') return <Forbidden />;
  return (
    <StubPage
      title="Wingers"
      subtitle="Authorize resellers and set winger prices."
      task="Phase 05"
    />
  );
}
