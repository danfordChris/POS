import Link from 'next/link';
import { ErrorCard } from '@/components/ui';
import { ProductForm } from '@/components/catalog/ProductForm';
import { ProductActions } from '@/components/catalog/ProductActions';
import { getSession } from '@/lib/session';
import { tenantGet } from '@/lib/tenant-api';
import type { Category, Product } from '@/lib/models';
import { updateProduct } from '../actions';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  let product: Product;
  let categories: Category[];
  try {
    [product, categories] = await Promise.all([
      tenantGet<Product>(`/products/${id}`),
      tenantGet<Category[]>('/categories'),
    ]);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return (
      <ErrorCard
        code={err.code ?? 'not_found'}
        title="Could not load this product"
        body={err.message}
      />
    );
  }

  const boundUpdate = updateProduct.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/catalog" className="text-caption text-accent">
          ← Catalog
        </Link>
        <h1 className="text-h1 font-bold mt-1">{product.name}</h1>
        <p className="text-caption text-text-secondary">{product.sku}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ProductForm
          categories={categories}
          canEditPrices={session?.role === 'owner'}
          action={boundUpdate}
          product={product}
          submitLabel="Save changes"
        />
        <ProductActions product={product} />
      </div>
    </div>
  );
}
