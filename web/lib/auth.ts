import 'server-only';
import { cookies } from 'next/headers';
import { AT, AT_EXP, BIZ, COOKIE_BASE, ROLE, RT, RT_MAX_AGE, type TokenBundle } from './auth-edge';

export { AT, RT, BIZ, ROLE, type TokenBundle } from './auth-edge';

/** Set the auth cookies from a route handler / server action. */
export async function writeAuthCookies(t: TokenBundle): Promise<void> {
  const jar = await cookies();
  jar.set(AT, t.accessToken, { ...COOKIE_BASE, maxAge: t.expiresIn });
  jar.set(RT, t.refreshToken, { ...COOKIE_BASE, maxAge: RT_MAX_AGE });
  jar.set(AT_EXP, String(Date.now() + t.expiresIn * 1000), {
    ...COOKIE_BASE,
    maxAge: t.expiresIn,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  for (const name of [AT, RT, AT_EXP, BIZ, ROLE]) jar.delete(name);
}

export async function setActiveBusiness(businessId: string, role: string): Promise<void> {
  const jar = await cookies();
  jar.set(BIZ, businessId, { ...COOKIE_BASE, maxAge: RT_MAX_AGE });
  jar.set(ROLE, role, { ...COOKIE_BASE, maxAge: RT_MAX_AGE });
}

export async function currentAccessToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(AT)?.value;
}

export async function currentRefreshToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(RT)?.value;
}
