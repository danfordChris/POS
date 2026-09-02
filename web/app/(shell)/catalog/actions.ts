'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { tenantSend, tenantUpload } from '@/lib/tenant-api';
import type { Product } from '@/lib/models';

export interface FormState {
  error?: { code: string; message: string };
}

function num(v: FormDataEntryValue | null): number | undefined {
  if (v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? undefined : s;
}

function productBody(fd: FormData): Record<string, unknown> {
  return {
    sku: str(fd.get('sku')),
    name: str(fd.get('name')),
    description: str(fd.get('description')),
    category_id: str(fd.get('category_id')),
    unit: str(fd.get('unit')),
    code: str(fd.get('code')),
    reorder_threshold: num(fd.get('reorder_threshold')),
    // Ignored server-side for Staff; harmless to send.
    cost_price: num(fd.get('cost_price')),
    sell_price: num(fd.get('sell_price')),
    winger_price: num(fd.get('winger_price')),
  };
}

export async function createProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  let created: Product;
  try {
    created = await tenantSend<Product>('POST', '/products', productBody(fd));
  } catch (e) {
    if (e instanceof ApiError) return { error: { code: e.code, message: e.message } };
    throw e;
  }
  revalidatePath('/catalog');
  redirect(`/catalog/${created.id}`);
}

export async function updateProduct(
  id: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  try {
    await tenantSend<Product>('PATCH', `/products/${id}`, productBody(fd));
  } catch (e) {
    if (e instanceof ApiError) return { error: { code: e.code, message: e.message } };
    throw e;
  }
  revalidatePath('/catalog');
  revalidatePath(`/catalog/${id}`);
  return {};
}

export async function deactivateProduct(
  id: string,
  _prev: FormState,
  _fd?: FormData,
): Promise<FormState> {
  try {
    await tenantSend('POST', `/products/${id}/deactivate`);
  } catch (e) {
    if (e instanceof ApiError) return { error: { code: e.code, message: e.message } };
    throw e;
  }
  revalidatePath('/catalog');
  revalidatePath(`/catalog/${id}`);
  return {};
}

export async function createCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    await tenantSend('POST', '/categories', { name: str(fd.get('name')) });
  } catch (e) {
    if (e instanceof ApiError) return { error: { code: e.code, message: e.message } };
    throw e;
  }
  revalidatePath('/catalog');
  return {};
}

export async function uploadProductImage(
  id: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const file = fd.get('image');
  if (!(file instanceof File) || file.size === 0) {
    return { error: { code: 'validation_error', message: 'Choose an image file' } };
  }
  const forward = new FormData();
  forward.set('image', file);
  try {
    await tenantUpload(`/products/${id}/image`, forward);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return {
      error: { code: err.code ?? 'unknown', message: err.message ?? 'Upload failed' },
    };
  }
  revalidatePath(`/catalog/${id}`);
  return {};
}
