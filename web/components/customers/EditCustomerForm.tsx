'use client';

import { useActionState } from 'react';
import { Button, Card, ErrorCard, TextField } from '@/components/ui';
import { updateCustomer, type CustomerActionState } from '@/app/(shell)/customers/actions';
import type { Customer } from '@/lib/models';

export function EditCustomerForm({ customer }: { customer: Customer }) {
  const bound = updateCustomer.bind(null, customer.id);
  const [state, action, pending] = useActionState<CustomerActionState, FormData>(bound, {});

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-h3 font-semibold">Details</h2>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <TextField name="name" defaultValue={customer.name} aria-label="Name" />
        <TextField
          name="email"
          type="email"
          defaultValue={customer.email ?? ''}
          placeholder="Email"
          aria-label="Email"
        />
        <TextField
          name="phone"
          type="tel"
          defaultValue={customer.phone ?? ''}
          placeholder="Phone"
          aria-label="Phone"
        />
        <TextField
          name="tax_id"
          defaultValue={customer.tax_id ?? ''}
          placeholder="Tax ID"
          aria-label="Tax ID"
        />
        <TextField
          name="address"
          defaultValue={customer.address ?? ''}
          placeholder="Address"
          aria-label="Address"
          className="sm:col-span-2"
        />
        <label className="flex items-center gap-2 text-caption text-text-secondary sm:col-span-2">
          <input type="checkbox" name="disabled" defaultChecked={customer.disabled} />
          Deactivate this customer (hide from the default list)
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
      {state.error ? <ErrorCard code={state.error.code} title={state.error.message} /> : null}
      {state.ok ? <p className="text-caption text-success">Saved.</p> : null}
    </Card>
  );
}
