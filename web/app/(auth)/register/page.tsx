'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, ErrorCard, TextField } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? { code: 'unknown', message: 'Could not register' });
        return;
      }
      router.replace('/onboarding');
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
          <h1 className="text-h2 font-bold">Create your account</h1>
          <p className="text-caption text-text-secondary mt-1">
            You&apos;ll set up your business next.
          </p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <TextField
            label="Your name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 12 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </form>
      </Card>

      {error ? <ErrorCard code={error.code} title={error.message} /> : null}

      <p className="text-caption text-text-secondary text-center">
        Already have an account?{' '}
        <Link className="text-accent font-semibold" href="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
