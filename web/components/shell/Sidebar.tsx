'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';
import { cn } from '@/components/ui';

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-[232px] shrink-0 flex-col gap-6 bg-surface px-4 py-6 shadow-elev-md">
      <div className="px-3 text-h3 font-extrabold tracking-tight">Duka&nbsp;Stock</div>

      <nav className="flex flex-col gap-6">
        {NAV.map((section) => {
          const items = section.items.filter((i) => !i.ownerOnly || role === 'owner');
          if (items.length === 0) return null;
          return (
            <div key={section.title} className="flex flex-col gap-1">
              <span className="px-3 text-overline uppercase tracking-wide text-text-disabled">
                {section.title}
              </span>
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-control px-3 py-2 text-body transition-[box-shadow,color]',
                      active
                        ? 'bg-surface-sunken text-text-primary shadow-elev-inset font-semibold'
                        : 'text-text-secondary hover:text-text-primary',
                    )}
                  >
                    <Icon size={20} strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
