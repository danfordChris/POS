'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SegmentedControl, TextField } from '@/components/ui';
import type { Category } from '@/lib/models';

const ACTIVE_OPTS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
] as const;

export function CatalogFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === '' || value === 'all') next.delete(key);
    else next.set(key, value);
    next.delete('cursor');
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <TextField
        label="Search"
        placeholder="Name or SKU"
        defaultValue={params.get('q') ?? ''}
        className="min-w-56"
        onChange={(e) => setParam('q', e.target.value)}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold text-text-secondary">Category</span>
        <select
          defaultValue={params.get('category_id') ?? ''}
          onChange={(e) => setParam('category_id', e.target.value)}
          className="h-11 rounded-control bg-surface-sunken px-3.5 text-body text-text-primary shadow-elev-inset outline-none"
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold text-text-secondary">Status</span>
        <SegmentedControl
          aria-label="Status filter"
          options={ACTIVE_OPTS}
          value={(params.get('active') as 'true' | 'false') ?? 'all'}
          onChange={(v) => setParam('active', v)}
        />
      </div>
    </div>
  );
}
