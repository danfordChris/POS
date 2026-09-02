import { ThemeToggle } from '@/components/ui';
import { BusinessSwitcher } from './BusinessSwitcher';
import { SignOutButton } from './SignOutButton';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function Header({
  businessName,
  userName,
  role,
}: {
  businessName: string;
  userName: string;
  role: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 bg-surface px-6 py-3 shadow-elev-sm">
      <BusinessSwitcher businessName={businessName} />
      <div className="flex-1" />
      <ThemeToggle />
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end leading-tight">
          <span className="text-caption font-semibold">{userName}</span>
          <span className="text-overline uppercase tracking-wide text-text-disabled">{role}</span>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-pill bg-surface-sunken text-caption font-bold shadow-elev-inset">
          {initials(userName)}
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
