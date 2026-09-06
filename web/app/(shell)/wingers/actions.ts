'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api';
import { tenantSend } from '@/lib/tenant-api';
import type { WingerAccount } from '@/lib/models';

export interface WingerActionState {
  ok?: boolean;
  error?: { code: string; message: string };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function friendly(e: ApiError): { code: string; message: string } {
  if (e.code === 'already_a_member') {
    return {
      code: e.code,
      message: 'That person is already a staff member of this business.',
    };
  }
  if (e.code === 'upstream_unavailable') {
    return { code: e.code, message: 'A service is busy. Try again in a moment.' };
  }
  return { code: e.code, message: e.message };
}

export async function authorizeWinger(
  _prev: WingerActionState,
  fd: FormData,
): Promise<WingerActionState> {
  const kind = fd.get('kind') === 'phone' ? 'phone' : 'email';
  const value = (fd.get('identifier') as string | null)?.trim() ?? '';

  if (!value) {
    return { error: { code: 'validation_error', message: 'Enter an email or phone number.' } };
  }
  if (kind === 'email' && !EMAIL_RE.test(value)) {
    return { error: { code: 'validation_error', message: 'That is not a valid email address.' } };
  }

  try {
    await tenantSend<WingerAccount>('POST', '/winger-accounts', { [kind]: value });
  } catch (e) {
    if (e instanceof ApiError) return { error: friendly(e) };
    throw e;
  }
  revalidatePath('/wingers');
  return { ok: true };
}

export async function setWingerStatus(
  id: string,
  status: 'active' | 'suspended',
  _prev: WingerActionState,
  _fd: FormData,
): Promise<WingerActionState> {
  try {
    await tenantSend<WingerAccount>('PATCH', `/winger-accounts/${id}`, { status });
  } catch (e) {
    if (e instanceof ApiError) return { error: friendly(e) };
    throw e;
  }
  revalidatePath('/wingers');
  return { ok: true };
}
