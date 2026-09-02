'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api';
import { tenantSend } from '@/lib/tenant-api';

export interface MovementState {
  error?: { code: string; message: string };
  ok?: boolean;
}

export async function recordMovement(_prev: MovementState, fd: FormData): Promise<MovementState> {
  const type = String(fd.get('type') || 'stock_in');
  const raw = Number(fd.get('quantity_delta'));
  if (!Number.isFinite(raw) || raw === 0) {
    return {
      error: { code: 'validation_error', message: 'Enter a non-zero quantity' },
    };
  }
  // A stock-in is always positive; an adjustment keeps its sign.
  const quantity_delta = type === 'stock_in' ? Math.abs(raw) : raw;

  try {
    await tenantSend('POST', '/stock/movements', {
      product_id: String(fd.get('product_id') || ''),
      type,
      quantity_delta,
      reason: (fd.get('reason') as string)?.trim() || undefined,
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return { error: { code: e.code, message: e.message } };
    }
    throw e;
  }
  revalidatePath('/stock');
  revalidatePath('/stock/movements');
  revalidatePath('/catalog');
  return { ok: true };
}
