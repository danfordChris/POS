import { Button, ErrorCard } from '@/components/ui';
import { StockTable } from '@/components/stock/StockTable';
import { RecordMovementForm } from '@/components/stock/RecordMovementForm';
import { tenantGet } from '@/lib/tenant-api';
import type { Page, Product, StockItem } from '@/lib/models';

export default async function StockPage() {
  let items: StockItem[];
  let products: Product[];
  try {
    [items, products] = await Promise.all([
      tenantGet<{ data: StockItem[] }>('/stock', { limit: 100 }).then((r) => r.data),
      tenantGet<Page<Product>>('/products', { limit: 100 }).then((r) => r.data),
    ]);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return (
      <ErrorCard code={err.code ?? 'load_failed'} title="Could not load stock" body={err.message} />
    );
  }

  const low = items.filter((s) => s.low_stock).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold">Stock</h1>
          <p className="text-body text-text-secondary mt-1">
            {items.length} products · {low} low
          </p>
        </div>
        <a href="/stock/export" download>
          <Button variant="secondary">Export CSV</Button>
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <StockTable items={items} products={products} />
        <RecordMovementForm products={products} />
      </div>
    </div>
  );
}
