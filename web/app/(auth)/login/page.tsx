'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, ErrorCard, TextField } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? { code: 'unknown', message: 'Could not sign in' });
        return;
      }
      // Navigate so the middleware + server components pick up the new cookies.
      router.replace(next);
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
          <h1 className="text-h2 font-bold">Sign in</h1>
          <p className="text-caption text-text-secondary mt-1">Use your Duka Stock account.</p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={submit}>
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>

      {error ? <ErrorCard code={error.code} title={error.message} /> : null}

      <p className="text-caption text-text-secondary text-center">
        New here?{' '}
        <Link className="text-accent font-semibold" href="/register">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
