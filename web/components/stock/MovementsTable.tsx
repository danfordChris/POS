import type { Product, StockMovement } from '@/lib/models';

const TYPE_STYLE: Record<string, string> = {
  stock_in: 'text-success',
  adjustment: 'text-info',
  sale: 'text-text-primary',
  return: 'text-info',
  void_reversal: 'text-warning',
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
      <div className="rounded-card bg-surface-sunken px-6 py-10 text-center text-body text-text-secondary shadow-elev-inset">
        No movements match these filters.
      </div>
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
              <td
                className={`px-4 py-3 font-semibold ${TYPE_STYLE[m.type] ?? 'text-text-primary'}`}
              >
                {m.type}
              </td>
              <td className="px-4 py-3 text-right tnum font-semibold">
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
