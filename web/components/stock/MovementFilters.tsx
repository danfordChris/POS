'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Product } from '@/lib/models';

const TYPES = ['stock_in', 'adjustment', 'sale', 'return', 'void_reversal'] as const;

export function MovementFilters({ products }: { products: Product[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === '') next.delete(key);
    else next.set(key, value);
    next.delete('cursor');
    start(() => router.replace(`${pathname}?${next.toString()}`));
  }

  const field =
    'h-11 rounded-control bg-surface-sunken px-3.5 text-body text-text-primary shadow-elev-inset outline-none';

  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold text-text-secondary">Product</span>
        <select
          className={field}
          defaultValue={params.get('product_id') ?? ''}
          onChange={(e) => setParam('product_id', e.target.value)}
        >
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold text-text-secondary">Type</span>
        <select
          className={field}
          defaultValue={params.get('type') ?? ''}
          onChange={(e) => setParam('type', e.target.value)}
        >
          <option value="">All types</option>
          {TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {tp}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
