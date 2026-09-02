import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/ui';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-8 p-6">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <span className="text-h3 font-extrabold tracking-tight">Duka&nbsp;Stock</span>
          <ThemeToggle />
        </div>
        {children}
      </div>
    </div>
  );
}
