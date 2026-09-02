import { NextResponse } from 'next/server';
import { ApiError, apiFetch } from '@/lib/api';
import { currentAccessToken, setActiveBusiness } from '@/lib/auth';

/** Create a business and make it the caller's active context (they become Owner). */
export async function POST(req: Request): Promise<NextResponse> {
  const token = await currentAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: { code: 'unauthenticated', message: 'Sign in first' } },
      { status: 401 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Invalid request body' } },
      { status: 400 },
    );
  }

  try {
    const biz = await apiFetch<{ id: string }>('/v1/businesses', {
      method: 'POST',
      token,
      body: payload,
    });
    await setActiveBusiness(biz.id, 'owner');
    return NextResponse.json({ ok: true, id: biz.id });
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
