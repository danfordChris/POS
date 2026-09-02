import Link from 'next/link';
import { Package } from 'lucide-react';
import { Badge, EmptyState } from '@/components/ui';
import { formatMoney, type Category, type Product, type StockItem } from '@/lib/models';

export function ProductTable({
  products,
  categories,
  stock,
  showCost,
}: {
  products: Product[];
  categories: Category[];
  stock: Map<string, StockItem>;
  showCost: boolean;
}) {
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<Package />}
        title="No products match"
        description="Adjust the filters, or add your first product to the catalog."
        action={{ label: 'New product', href: '/catalog/new' }}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-elev-md">
      <table className="w-full text-body">
        <thead>
          <tr className="text-caption uppercase tracking-wide text-text-disabled">
            <th className="px-4 py-3 text-left font-semibold">Product</th>
            <th className="px-4 py-3 text-left font-semibold">Category</th>
            <th className="px-4 py-3 text-right font-semibold">On hand</th>
            <th className="px-4 py-3 text-right font-semibold">Sell</th>
            {showCost ? <th className="px-4 py-3 text-right font-semibold">Cost</th> : null}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const s = stock.get(p.id);
            return (
              <tr key={p.id} className="border-t border-surface-sunken hover:bg-surface-sunken/60">
                <td className="px-4 py-3">
                  <Link
                    href={`/catalog/${p.id}`}
                    className="font-semibold text-text-primary hover:text-accent"
                  >
                    {p.name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-caption text-text-secondary">
                    <span>{p.sku}</span>
                    {p.is_active ? null : <Badge tone="neutral">inactive</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {p.category_id ? (catName.get(p.category_id) ?? '—') : '—'}
                </td>
                <td className="px-4 py-3 text-right tnum">
                  <span className="inline-flex items-center gap-2">
                    {s ? s.on_hand : '—'}
                    {s?.low_stock ? <Badge tone="warning">low</Badge> : null}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tnum">
                  {formatMoney(p.sell_price, p.currency)}
                </td>
                {showCost ? (
                  <td className="px-4 py-3 text-right tnum text-text-secondary">
                    {p.cost_price !== undefined ? formatMoney(p.cost_price, p.currency) : '—'}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
