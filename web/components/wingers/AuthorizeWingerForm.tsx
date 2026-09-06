'use client';

import { useActionState, useState } from 'react';
import { Button, Card, ErrorCard, SegmentedControl, TextField } from '@/components/ui';
import { authorizeWinger, type WingerActionState } from '@/app/(shell)/wingers/actions';

export function AuthorizeWingerForm() {
  const [kind, setKind] = useState<'email' | 'phone'>('email');
  const [state, action, pending] = useActionState<WingerActionState, FormData>(authorizeWinger, {});

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h3 font-semibold">Authorize a reseller</h2>
        <p className="text-caption text-text-secondary">
          They get a read-only catalog with your winger prices — nothing else.
        </p>
      </div>
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="kind" value={kind} />
        <SegmentedControl
          value={kind}
          onChange={(v) => setKind(v as 'email' | 'phone')}
          options={[
            { value: 'email', label: 'Email' },
            { value: 'phone', label: 'Phone' },
          ]}
        />
        <TextField
          name="identifier"
          type={kind === 'email' ? 'email' : 'tel'}
          placeholder={kind === 'email' ? 'reseller@example.com' : '+255…'}
          className="flex-1"
          aria-label={kind === 'email' ? 'Reseller email' : 'Reseller phone'}
        />
        <Button type="submit" disabled={pending}>
          {pending ? 'Authorizing…' : 'Authorize'}
        </Button>
      </form>
      {state.error ? <ErrorCard code={state.error.code} title={state.error.message} /> : null}
      {state.ok ? <p className="text-caption text-success">Reseller authorized.</p> : null}
    </Card>
  );
}
