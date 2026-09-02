import Link from 'next/link';
import type { Product, StockItem } from '@/lib/models';

export function StockTable({ items, products }: { items: StockItem[]; products: Product[] }) {
  const byId = new Map(products.map((p) => [p.id, p]));

  if (items.length === 0) {
    return (
      <div className="rounded-card bg-surface-sunken px-6 py-10 text-center text-body text-text-secondary shadow-elev-inset">
        No stock records yet. Record a stock-in to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-elev-md">
      <table className="w-full text-body">
        <thead>
          <tr className="text-caption uppercase tracking-wide text-text-disabled">
            <th className="px-4 py-3 text-left font-semibold">Product</th>
            <th className="px-4 py-3 text-right font-semibold">On hand</th>
            <th className="px-4 py-3 text-right font-semibold">Reorder at</th>
            <th className="px-4 py-3 text-left font-semibold">Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => {
            const p = byId.get(s.product_id);
            return (
              <tr key={s.product_id} className="border-t border-surface-sunken">
                <td className="px-4 py-3">
                  <Link
                    href={`/catalog/${s.product_id}`}
                    className="font-semibold text-text-primary hover:text-accent"
                  >
                    {p?.name ?? s.product_id}
                  </Link>
                  {p ? <div className="text-caption text-text-secondary">{p.sku}</div> : null}
                </td>
                <td className="px-4 py-3 text-right tnum">
                  {s.on_hand}
                  {s.low_stock ? (
                    <span className="ml-2 rounded-pill bg-warning/20 px-2 py-0.5 text-caption font-semibold text-warning">
                      low
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right tnum text-text-secondary">
                  {s.reorder_threshold || '—'}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {new Date(s.updated_at).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
