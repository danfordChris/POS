import Link from 'next/link';
import { ErrorCard } from '@/components/ui';
import { ProductForm } from '@/components/catalog/ProductForm';
import { getSession } from '@/lib/session';
import { tenantGet } from '@/lib/tenant-api';
import type { Category } from '@/lib/models';
import { createProduct } from '../actions';

export default async function NewProductPage() {
  const session = await getSession();
  let categories: Category[];
  try {
    categories = await tenantGet<Category[]>('/categories');
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return (
      <ErrorCard
        code={err.code ?? 'load_failed'}
        title="Could not open the product form"
        body={err.message}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/catalog" className="text-caption text-accent">
          ← Catalog
        </Link>
        <h1 className="text-h1 font-bold mt-1">New product</h1>
      </div>
      <ProductForm
        categories={categories}
        canEditPrices={session?.role === 'owner'}
        action={createProduct}
        submitLabel="Create product"
      />
    </div>
  );
}
