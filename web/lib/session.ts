import 'server-only';
import { cookies } from 'next/headers';
import { apiFetch } from './api';
import { AT, BIZ } from './auth-edge';

export type Role = 'owner' | 'staff' | 'winger';

export interface Me {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  locale: string;
}

export interface Session {
  user: Me;
  /** Selected business, or null when the user has not created / picked one. */
  businessId: string | null;
  businessName: string | null;
  role: Role | null;
}

/**
 * Resolves the current session from the auth cookie. The middleware keeps the
 * access token fresh, so a 401 here means "no session" rather than "expired".
 */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(AT)?.value;
  if (!token) return null;

  let user: Me;
  try {
    user = await apiFetch<Me>('/v1/auth/me', { token });
  } catch {
    return null;
  }

  const businessId = jar.get(BIZ)?.value ?? null;
  let businessName: string | null = null;
  let role: Role | null = null;

  if (businessId) {
    try {
      const biz = await apiFetch<{ name: string; role: Role | null }>(
        `/v1/businesses/${businessId}`,
        { token },
      );
      businessName = biz.name;
      role = biz.role;
    } catch {
      // Access to the stored business was lost — treat as no active business.
      return { user, businessId: null, businessName: null, role: null };
    }
  }

  return { user, businessId, businessName, role };
}
