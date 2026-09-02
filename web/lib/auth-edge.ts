// Auth helpers safe for the middleware (edge) runtime — no `next/headers`.
import type { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from './api';

export const AT = 'duka_at';
export const RT = 'duka_rt';
export const AT_EXP = 'duka_at_exp';
export const BIZ = 'duka_biz';
export const ROLE = 'duka_role';

export const RT_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function refreshWithKong(refreshToken: string): Promise<TokenBundle | null> {
  try {
    return await apiFetch<TokenBundle>('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
  } catch {
    return null;
  }
}

export function applyAuthToResponse(res: NextResponse, t: TokenBundle): void {
  res.cookies.set(AT, t.accessToken, { ...COOKIE_BASE, maxAge: t.expiresIn });
  res.cookies.set(RT, t.refreshToken, { ...COOKIE_BASE, maxAge: RT_MAX_AGE });
  res.cookies.set(AT_EXP, String(Date.now() + t.expiresIn * 1000), {
    ...COOKIE_BASE,
    maxAge: t.expiresIn,
  });
}

export function clearAuthOnResponse(res: NextResponse): void {
  for (const name of [AT, RT, AT_EXP, BIZ, ROLE]) res.cookies.delete(name);
}

export function readAuthState(req: NextRequest): {
  accessToken?: string;
  refreshToken?: string;
  expiresAt: number;
} {
  return {
    accessToken: req.cookies.get(AT)?.value,
    refreshToken: req.cookies.get(RT)?.value,
    expiresAt: Number(req.cookies.get(AT_EXP)?.value ?? 0),
  };
}
