import Link from 'next/link';
import { Button, ErrorCard } from '@/components/ui';
import { CatalogFilters } from '@/components/catalog/CatalogFilters';
import { ProductTable } from '@/components/catalog/ProductTable';
import { getSession } from '@/lib/session';
import { tenantGet } from '@/lib/tenant-api';
import type { Category, Page, Product, StockItem } from '@/lib/models';

type SP = Record<string, string | string[] | undefined>;

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  const session = await getSession();
  const showCost = session?.role === 'owner';

  let products: Page<Product>;
  let categories: Category[];
  let stockItems: StockItem[];
  try {
    [products, categories, stockItems] = await Promise.all([
      tenantGet<Page<Product>>('/products', {
        q: one('q'),
        category_id: one('category_id'),
        active: one('active'),
        cursor: one('cursor'),
        limit: 50,
      }),
      tenantGet<Category[]>('/categories'),
      tenantGet<{ data: StockItem[] }>('/stock', { limit: 100 }).then((r) => r.data),
    ]);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return (
      <ErrorCard
        code={err.code ?? 'load_failed'}
        title="Could not load the catalog"
        body={err.message}
      />
    );
  }

  const stock = new Map(stockItems.map((s) => [s.product_id, s]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold">Catalog</h1>
          <p className="text-body text-text-secondary mt-1">{products.data.length} shown</p>
        </div>
        <Link href="/catalog/new">
          <Button variant="primary">New product</Button>
        </Link>
      </div>

      <CatalogFilters categories={categories} />

      <ProductTable
        products={products.data}
        categories={categories}
        stock={stock}
        showCost={showCost}
      />

      {products.next_cursor ? (
        <div>
          <Link
            href={{
              pathname: '/catalog',
              query: { ...sp, cursor: products.next_cursor },
            }}
          >
            <Button variant="secondary">Load more</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
