import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { clearAuthCookies, currentRefreshToken } from '@/lib/auth';

export async function POST(): Promise<NextResponse> {
  const refreshToken = await currentRefreshToken();
  if (refreshToken) {
    try {
      await apiFetch('/v1/auth/logout', {
        method: 'POST',
        body: { refreshToken },
      });
    } catch {
      // Best effort — clear the local session regardless.
    }
  }
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
