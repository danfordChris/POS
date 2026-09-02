import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { Sidebar } from '@/components/shell/Sidebar';
import { Header } from '@/components/shell/Header';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.businessId) redirect('/onboarding');

  const role = session.role ?? 'staff';

  return (
    <div className="min-h-dvh flex">
      <Sidebar role={role} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          businessName={session.businessName ?? 'Your business'}
          userName={session.user.name}
          role={role}
        />
        <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
