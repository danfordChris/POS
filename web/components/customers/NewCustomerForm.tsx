'use client';

import { useActionState } from 'react';
import { Button, Card, ErrorCard, TextField } from '@/components/ui';
import { createCustomer, type CustomerActionState } from '@/app/(shell)/customers/actions';

export function NewCustomerForm() {
  const [state, action, pending] = useActionState<CustomerActionState, FormData>(
    createCustomer,
    {},
  );

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h3 font-semibold">Add a customer</h2>
        <p className="text-caption text-text-secondary">
          A named buyer you can invoice on account. Email is used for invoice notices.
        </p>
      </div>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <TextField name="name" placeholder="Name" aria-label="Name" required />
        <TextField name="email" type="email" placeholder="Email (optional)" aria-label="Email" />
        <TextField name="phone" type="tel" placeholder="Phone (optional)" aria-label="Phone" />
        <TextField name="tax_id" placeholder="Tax ID (optional)" aria-label="Tax ID" />
        <TextField
          name="address"
          placeholder="Address (optional)"
          aria-label="Address"
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Adding…' : 'Add customer'}
          </Button>
        </div>
      </form>
      {state.error ? <ErrorCard code={state.error.code} title={state.error.message} /> : null}
      {state.ok ? <p className="text-caption text-success">Customer added.</p> : null}
    </Card>
  );
}
