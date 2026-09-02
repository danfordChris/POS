'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, ErrorCard, SegmentedControl, TextField } from '@/components/ui';

const CURRENCIES = [
  { value: 'TZS', label: 'TZS' },
  { value: 'KES', label: 'KES' },
  { value: 'UGX', label: 'UGX' },
] as const;

export function OnboardingForm({ name }: { name: string }) {
  const router = useRouter();
  const [bizName, setBizName] = useState('');
  const [currency, setCurrency] = useState<string>('TZS');
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: bizName, currency }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.error ?? {
            code: 'unknown',
            message: 'Could not create the business',
          },
        );
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError({
        code: 'network_error',
        message: 'Could not reach the server. Try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-5">
        <div>
          <h1 className="text-h2 font-bold">Set up your business</h1>
          <p className="text-caption text-text-secondary mt-1">
            Welcome, {name}. Name your shop to get started — you&apos;ll be the Owner.
          </p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <TextField
            label="Business name"
            required
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            placeholder="Duka la Asha"
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-caption font-semibold text-text-secondary">Currency</span>
            <SegmentedControl
              aria-label="Currency"
              options={CURRENCIES}
              value={currency}
              onChange={setCurrency}
            />
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create business'}
          </Button>
        </form>
      </Card>
      {error ? <ErrorCard code={error.code} title={error.message} /> : null}
    </div>
  );
}
