import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { ThemeToggle } from '@/components/ui';
import { OnboardingForm } from './OnboardingForm';

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.businessId) redirect('/');

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-8 p-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <span className="text-h3 font-extrabold tracking-tight">Duka&nbsp;Stock</span>
          <ThemeToggle />
        </div>
        <OnboardingForm name={session.user.name} />
      </div>
    </div>
  );
}
