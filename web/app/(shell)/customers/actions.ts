'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api';
import { tenantSend } from '@/lib/tenant-api';
import type { Customer } from '@/lib/models';

export interface CustomerActionState {
  ok?: boolean;
  id?: string;
  error?: { code: string; message: string };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function str(fd: FormData, key: string): string {
  return ((fd.get(key) as string | null) ?? '').trim();
}

export async function createCustomer(
  _prev: CustomerActionState,
  fd: FormData,
): Promise<CustomerActionState> {
  const name = str(fd, 'name');
  const email = str(fd, 'email');
  if (!name) {
    return { error: { code: 'validation_error', message: 'Enter a customer name.' } };
  }
  if (email && !EMAIL_RE.test(email)) {
    return { error: { code: 'validation_error', message: 'That is not a valid email address.' } };
  }
  try {
    const c = await tenantSend<Customer>('POST', '/customers', {
      name,
      email: email || undefined,
      phone: str(fd, 'phone') || undefined,
      address: str(fd, 'address') || undefined,
      tax_id: str(fd, 'tax_id') || undefined,
    });
    revalidatePath('/customers');
    return { ok: true, id: c.id };
  } catch (e) {
    if (e instanceof ApiError) return { error: { code: e.code, message: e.message } };
    throw e;
  }
}

export async function updateCustomer(
  id: string,
  _prev: CustomerActionState,
  fd: FormData,
): Promise<CustomerActionState> {
  const email = str(fd, 'email');
  if (email && !EMAIL_RE.test(email)) {
    return { error: { code: 'validation_error', message: 'That is not a valid email address.' } };
  }
  try {
    await tenantSend<Customer>('PATCH', `/customers/${id}`, {
      name: str(fd, 'name') || undefined,
      email: email || null,
      phone: str(fd, 'phone') || null,
      address: str(fd, 'address') || null,
      tax_id: str(fd, 'tax_id') || null,
      disabled: fd.get('disabled') === 'on' ? true : undefined,
    });
    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: { code: e.code, message: e.message } };
    throw e;
  }
}

export async function setCustomerDisabled(
  id: string,
  disabled: boolean,
): Promise<CustomerActionState> {
  try {
    await tenantSend<Customer>('PATCH', `/customers/${id}`, { disabled });
    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: { code: e.code, message: e.message } };
    throw e;
  }
}
