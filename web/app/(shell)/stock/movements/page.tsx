import Link from 'next/link';
import { Button, ErrorCard } from '@/components/ui';
import { MovementFilters } from '@/components/stock/MovementFilters';
import { MovementsTable } from '@/components/stock/MovementsTable';
import { tenantGet } from '@/lib/tenant-api';
import type { Page, Product, StockMovement } from '@/lib/models';

type SP = Record<string, string | string[] | undefined>;

export default async function MovementsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  let movements: Page<StockMovement>;
  let products: Product[];
  try {
    [movements, products] = await Promise.all([
      tenantGet<Page<StockMovement>>('/stock/movements', {
        product_id: one('product_id'),
        type: one('type'),
        cursor: one('cursor'),
        limit: 50,
      }),
      tenantGet<Page<Product>>('/products', { limit: 100 }).then((r) => r.data),
    ]);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return (
      <ErrorCard
        code={err.code ?? 'load_failed'}
        title="Could not load movements"
        body={err.message}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-bold">Stock movements</h1>
        <p className="text-body text-text-secondary mt-1">{movements.data.length} shown</p>
      </div>

      <MovementFilters products={products} />
      <MovementsTable movements={movements.data} products={products} />

      {movements.next_cursor ? (
        <div>
          <Link
            href={{
              pathname: '/stock/movements',
              query: { ...sp, cursor: movements.next_cursor },
            }}
          >
            <Button variant="secondary">Load more</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
