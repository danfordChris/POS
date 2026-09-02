import { History } from 'lucide-react';
import { Badge, EmptyState, type BadgeTone } from '@/components/ui';
import type { Product, StockMovement } from '@/lib/models';

const TYPE_TONE: Record<string, BadgeTone> = {
  stock_in: 'success',
  adjustment: 'info',
  sale: 'neutral',
  return: 'info',
  void_reversal: 'warning',
};

export function MovementsTable({
  movements,
  products,
}: {
  movements: StockMovement[];
  products: Product[];
}) {
  const byId = new Map(products.map((p) => [p.id, p]));

  if (movements.length === 0) {
    return (
      <EmptyState
        icon={<History />}
        title="No movements match these filters"
        description="Clear the product or type filter, or record a movement from the Stock page."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-elev-md">
      <table className="w-full text-body">
        <thead>
          <tr className="text-caption uppercase tracking-wide text-text-disabled">
            <th className="px-4 py-3 text-left font-semibold">When</th>
            <th className="px-4 py-3 text-left font-semibold">Product</th>
            <th className="px-4 py-3 text-left font-semibold">Type</th>
            <th className="px-4 py-3 text-right font-semibold">Change</th>
            <th className="px-4 py-3 text-left font-semibold">Reason</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id} className="border-t border-surface-sunken">
              <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                {new Date(m.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3">{byId.get(m.product_id)?.name ?? m.product_id}</td>
              <td className="px-4 py-3">
                <Badge tone={TYPE_TONE[m.type] ?? 'neutral'}>{m.type}</Badge>
              </td>
              <td
                className={`px-4 py-3 text-right tnum font-semibold ${
                  m.quantity_delta > 0 ? 'text-success' : 'text-text-primary'
                }`}
              >
                {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
              </td>
              <td className="px-4 py-3 text-text-secondary">{m.reason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
