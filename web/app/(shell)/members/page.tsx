import { getSession } from '@/lib/session';
import { Forbidden } from '@/components/shell/Forbidden';
import { StubPage } from '@/components/shell/StubPage';

export default async function MembersPage() {
  const session = await getSession();
  if (session?.role !== 'owner') return <Forbidden />;
  return (
    <StubPage
      title="Members"
      subtitle="Invite Staff, suspend or remove them."
      task="Phase 01 follow-up"
    />
  );
}
