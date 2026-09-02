import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { Badge, EmptyState } from '@/components/ui';
import type { Product, StockItem } from '@/lib/models';

export function StockTable({ items, products }: { items: StockItem[]; products: Product[] }) {
  const byId = new Map(products.map((p) => [p.id, p]));

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Boxes />}
        title="No stock records yet"
        description="Record a stock-in from the panel on the right to start tracking on-hand."
      />
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
                  <span className="inline-flex items-center gap-2">
                    {s.on_hand}
                    {s.low_stock ? <Badge tone="warning">low</Badge> : null}
                  </span>
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
