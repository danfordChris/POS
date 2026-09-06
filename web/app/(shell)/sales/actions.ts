'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api';
import { tenantSend } from '@/lib/tenant-api';
import type { Sale } from '@/lib/models';

export interface VoidState {
  ok?: boolean;
  error?: { code: string; message: string };
}

export async function voidSale(id: string, _prev: VoidState, _fd: FormData): Promise<VoidState> {
  try {
    await tenantSend<Sale>('POST', `/sales/${id}/void`);
  } catch (e) {
    if (e instanceof ApiError) {
      return { error: { code: e.code, message: e.message } };
    }
    throw e;
  }
  revalidatePath('/sales');
  revalidatePath(`/sales/${id}`);
  return { ok: true };
}
