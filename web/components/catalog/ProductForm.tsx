'use client';

import { useActionState } from 'react';
import { Button, Card, ErrorCard, TextField } from '@/components/ui';
import type { Category, Product } from '@/lib/models';
import type { FormState } from '@/app/(shell)/catalog/actions';

interface Props {
  categories: Category[];
  canEditPrices: boolean;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  product?: Product;
  submitLabel: string;
}

export function ProductForm({ categories, canEditPrices, action, product, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card className="grid gap-4 sm:grid-cols-2">
        <TextField label="SKU" name="sku" required defaultValue={product?.sku} />
        <TextField label="Name" name="name" required defaultValue={product?.name} />
        <TextField label="Barcode / QR code" name="code" defaultValue={product?.code ?? ''} />
        <TextField label="Unit" name="unit" placeholder="each" defaultValue={product?.unit} />
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-caption font-semibold text-text-secondary">Category</span>
          <select
            name="category_id"
            defaultValue={product?.category_id ?? ''}
            className="h-11 rounded-control bg-surface-sunken px-3.5 text-body text-text-primary shadow-elev-inset outline-none"
          >
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Description"
          name="description"
          className="sm:col-span-2"
          defaultValue={product?.description ?? ''}
        />
        <TextField
          label="Reorder threshold"
          name="reorder_threshold"
          type="number"
          inputMode="numeric"
          defaultValue={String(product?.reorder_threshold ?? 0)}
        />
      </Card>

      {canEditPrices ? (
        <Card className="grid gap-4 sm:grid-cols-3">
          <p className="text-caption text-text-secondary sm:col-span-3">
            Prices are in minor units and visible to Owners only.
          </p>
          <TextField
            label="Cost price"
            name="cost_price"
            type="number"
            inputMode="numeric"
            defaultValue={product?.cost_price !== undefined ? String(product.cost_price) : ''}
          />
          <TextField
            label="Sell price"
            name="sell_price"
            type="number"
            inputMode="numeric"
            defaultValue={String(product?.sell_price ?? '')}
          />
          <TextField
            label="Winger price"
            name="winger_price"
            type="number"
            inputMode="numeric"
            defaultValue={
              product?.winger_price !== null && product?.winger_price !== undefined
                ? String(product.winger_price)
                : ''
            }
          />
        </Card>
      ) : (
        <input type="hidden" name="_prices_locked" value="staff" />
      )}

      {state.error ? <ErrorCard code={state.error.code} title={state.error.message} /> : null}

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
