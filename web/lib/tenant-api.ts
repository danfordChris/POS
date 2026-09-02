import 'server-only';
import { cookies } from 'next/headers';
import { apiFetch, type ApiFetchOptions } from './api';
import { AT, BIZ, ROLE } from './auth-edge';
import type { Role } from './session';

export interface TenantContext {
  token: string;
  businessId: string;
  role: Role;
}

/** Resolves the token + active business for a tenant-scoped request. Throws when
 * the caller has no session or no selected business (the shell layout prevents
 * both, so this is a guard, not a user path). */
export async function getTenantContext(): Promise<TenantContext> {
  const jar = await cookies();
  const token = jar.get(AT)?.value;
  const businessId = jar.get(BIZ)?.value;
  if (!token || !businessId) {
    throw new Error('no_tenant_context');
  }
  return {
    token,
    businessId,
    role: (jar.get(ROLE)?.value as Role) ?? 'staff',
  };
}

function qs(query?: Record<string, string | number | undefined>): string {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export async function tenantGet<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const { token, businessId } = await getTenantContext();
  return apiFetch<T>(`/v1/businesses/${businessId}${path}${qs(query)}`, {
    token,
  });
}

export async function tenantSend<T>(
  method: NonNullable<ApiFetchOptions['method']>,
  path: string,
  body?: unknown,
): Promise<T> {
  const { token, businessId } = await getTenantContext();
  return apiFetch<T>(`/v1/businesses/${businessId}${path}`, {
    method,
    body,
    token,
  });
}

/** Multipart passthrough (product image upload). */
export async function tenantUpload<T>(path: string, form: FormData): Promise<T> {
  const { token, businessId } = await getTenantContext();
  const base = process.env.API_BASE_URL ?? 'http://localhost:8000';
  const res = await fetch(`${base}/v1/businesses/${businessId}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
    cache: 'no-store',
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = json?.error ?? {};
    throw Object.assign(new Error(err.message ?? 'Upload failed'), {
      code: err.code ?? 'unknown',
      status: res.status,
    });
  }
  return json as T;
}
