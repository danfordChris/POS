'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api';
import { tenantSend } from '@/lib/tenant-api';
import type { Invoice } from '@/lib/models';

export interface InvoiceActionState {
  ok?: boolean;
  error?: { code: string; message: string };
}

const METHODS = ['cash', 'bank_transfer', 'mobile_money', 'other'];

function friendly(e: ApiError): { code: string; message: string } {
  if (e.code === 'overpayment') {
    return { code: e.code, message: 'That is more than the balance due on this invoice.' };
  }
  if (e.code === 'invoice_not_payable') {
    return { code: e.code, message: 'This invoice is already paid or void.' };
  }
  return { code: e.code, message: e.message };
}

export async function recordPayment(
  invoiceId: string,
  _prev: InvoiceActionState,
  fd: FormData,
): Promise<InvoiceActionState> {
  const amount = Number(fd.get('amount_minor'));
  const method = String(fd.get('method') ?? 'cash');
  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: { code: 'validation_error', message: 'Enter a payment amount.' } };
  }
  if (!METHODS.includes(method)) {
    return { error: { code: 'validation_error', message: 'Pick a payment method.' } };
  }
  try {
    await tenantSend<Invoice>('POST', `/invoices/${invoiceId}/payments`, {
      amount_minor: amount,
      method,
      reference: ((fd.get('reference') as string | null) ?? '').trim() || undefined,
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: friendly(e) };
    throw e;
  }
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}

export async function voidInvoice(
  invoiceId: string,
  _prev: InvoiceActionState,
  fd: FormData,
): Promise<InvoiceActionState> {
  try {
    await tenantSend<Invoice>('POST', `/invoices/${invoiceId}/void`, {
      reason: ((fd.get('reason') as string | null) ?? '').trim() || undefined,
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: friendly(e) };
    throw e;
  }
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}
