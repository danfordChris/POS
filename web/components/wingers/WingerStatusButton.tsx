'use client';

import { useActionState } from 'react';
import { Button, ErrorCard } from '@/components/ui';
import { setWingerStatus, type WingerActionState } from '@/app/(shell)/wingers/actions';

export function WingerStatusButton({ id, status }: { id: string; status: 'active' | 'suspended' }) {
  const next = status === 'active' ? 'suspended' : 'active';
  const bound = setWingerStatus.bind(null, id, next);
  const [state, action, pending] = useActionState<WingerActionState, FormData>(bound, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const msg =
          next === 'suspended'
            ? 'Suspend this reseller? They lose catalog access immediately.'
            : 'Reactivate this reseller?';
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      <Button
        type="submit"
        variant={next === 'suspended' ? 'destructive' : 'secondary'}
        size="sm"
        disabled={pending}
      >
        {pending ? 'Working…' : next === 'suspended' ? 'Suspend' : 'Reactivate'}
      </Button>
      {state.error ? <ErrorCard code={state.error.code} title={state.error.message} /> : null}
    </form>
  );
}
