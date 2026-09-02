'use client';

import { useActionState, useState } from 'react';
import { Button, Card, ErrorCard, SegmentedControl, TextField } from '@/components/ui';
import { recordMovement, type MovementState } from '@/app/(shell)/stock/actions';
import type { Product } from '@/lib/models';

const TYPES = [
  { value: 'stock_in', label: 'Stock in' },
  { value: 'adjustment', label: 'Adjustment' },
] as const;

export function RecordMovementForm({ products }: { products: Product[] }) {
  const [type, setType] = useState<'stock_in' | 'adjustment'>('stock_in');
  const [state, action, pending] = useActionState<MovementState, FormData>(recordMovement, {});

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h3 font-semibold">Record movement</h2>
        <p className="text-caption text-text-secondary">
          Stock-in adds units; an adjustment can be negative.
        </p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="type" value={type} />
        <SegmentedControl
          aria-label="Movement type"
          options={TYPES}
          value={type}
          onChange={(v) => setType(v)}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-text-secondary">Product</span>
          <select
            name="product_id"
            required
            defaultValue=""
            className="h-11 rounded-control bg-surface-sunken px-3.5 text-body text-text-primary shadow-elev-inset outline-none"
          >
            <option value="" disabled>
              Choose a product
            </option>
            {products
              .filter((p) => p.is_active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.sku}
                </option>
              ))}
          </select>
        </label>
        <TextField
          label={type === 'stock_in' ? 'Quantity in' : 'Quantity change (±)'}
          name="quantity_delta"
          type="number"
          inputMode="numeric"
          required
        />
        <TextField label="Reason" name="reason" placeholder="Optional" />
        {state.error ? <ErrorCard code={state.error.code} title={state.error.message} /> : null}
        {state.ok ? <p className="text-caption text-success">Movement recorded.</p> : null}
        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Recording…' : 'Record'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
