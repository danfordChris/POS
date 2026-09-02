import { getSession } from '@/lib/session';
import { Forbidden } from '@/components/shell/Forbidden';
import { StubPage } from '@/components/shell/StubPage';

export default async function SettingsPage() {
  const session = await getSession();
  if (session?.role !== 'owner') return <Forbidden />;
  return (
    <StubPage
      title="Settings"
      subtitle="Business name, currency, locale, timezone."
      task="T-0109"
    />
  );
}
