import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '@/lib/api';
import { writeAuthCookies, type TokenBundle } from '@/lib/auth';

export async function POST(req: Request): Promise<NextResponse> {
  let payload: { email?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Invalid request body' } },
      { status: 400 },
    );
  }

  try {
    const tokens = await apiFetch<TokenBundle>('/v1/auth/login', {
      method: 'POST',
      body: { email: payload.email, password: payload.password },
    });
    await writeAuthCookies(tokens);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status || 502 },
      );
    }
    throw err;
  }
}
