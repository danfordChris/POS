import Link from 'next/link';
import { getSession } from '@/lib/session';
import { tenantGet } from '@/lib/tenant-api';
import { Badge, Button, Card, ErrorCard } from '@/components/ui';
import {
  formatMoney,
  type Customer,
  type InvoiceSummary,
  type Page,
  type Product,
  type StockItem,
} from '@/lib/models';

export default async function DashboardPage() {
  const session = await getSession();
  const name = session?.user.name ?? '';

  let products: Product[] = [];
  let stock: StockItem[] = [];
  let owing: Customer[] = [];
  let overdue: InvoiceSummary[] = [];
  let loadError: string | null = null;
  try {
    [products, stock, owing, overdue] = await Promise.all([
      tenantGet<Page<Product>>('/products', { limit: 100 }).then((r) => r.data),
      tenantGet<{ data: StockItem[] }>('/stock', { limit: 100 }).then((r) => r.data),
      tenantGet<Page<Customer>>('/customers', { has_balance: 'true', limit: 100 }).then(
        (r) => r.data,
      ),
      tenantGet<Page<InvoiceSummary>>('/invoices', { overdue: 'true', limit: 100 }).then(
        (r) => r.data,
      ),
    ]);
  } catch (e) {
    loadError = (e as { message?: string }).message ?? 'load failed';
  }

  const receivable = owing.reduce((sum, c) => sum + c.outstanding_balance, 0);

  const onHand = new Map(stock.map((s) => [s.product_id, s]));
  const low = stock.filter((s) => s.low_stock);
  const currency = products[0]?.currency ?? 'TZS';
  const stockValue = products.reduce(
    (sum, p) => sum + (onHand.get(p.id)?.on_hand ?? 0) * p.sell_price,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-bold">Dashboard</h1>
        <p className="text-body text-text-secondary mt-1">
          Welcome back{name ? `, ${name.split(' ')[0]}` : ''}.
        </p>
      </div>

      {loadError ? (
        <ErrorCard code="load_failed" title="Could not load your figures" body={loadError} />
      ) : (
        <>
          <Card className="flex flex-col gap-4">
            <div>
              <span className="text-caption text-text-secondary">Stock value at retail</span>
              <div className="text-display font-bold tnum">{formatMoney(stockValue, currency)}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 border-t border-surface-sunken pt-4">
              <Stat label="Products" value={String(products.length)} />
              <Stat label="Low on stock" value={String(low.length)} badge={low.length > 0} />
              <Stat label="Today's sales" value="—" hint="Phase 04" />
            </div>
          </Card>

          {receivable > 0 || overdue.length > 0 ? (
            <Card className="flex items-center justify-between">
              <div>
                <span className="text-caption text-text-secondary">Owed to you</span>
                <div className="text-h2 font-bold tnum">{formatMoney(receivable, currency)}</div>
                <span className="text-caption text-text-secondary">
                  {owing.length} customer{owing.length === 1 ? '' : 's'} · {overdue.length} overdue
                  invoice{overdue.length === 1 ? '' : 's'}
                </span>
              </div>
              <Link
                href="/invoices?overdue=true"
                className="text-caption font-semibold text-accent"
              >
                View overdue
              </Link>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link href="/catalog/new">
              <Button variant="primary">New product</Button>
            </Link>
            <Link href="/stock">
              <Button variant="secondary">Record stock</Button>
            </Link>
            <Link href="/stock/movements">
              <Button variant="secondary">Movements</Button>
            </Link>
          </div>

          {low.length > 0 ? (
            <Card className="p-0">
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h2 className="text-h3 font-semibold">Requires attention</h2>
                <Link href="/stock" className="text-caption font-semibold text-accent">
                  View all
                </Link>
              </div>
              <ul className="divide-y divide-surface-sunken">
                {low.slice(0, 5).map((s) => {
                  const p = products.find((x) => x.id === s.product_id);
                  return (
                    <li key={s.product_id} className="flex items-center gap-3 px-6 py-3">
                      <Link
                        href={`/catalog/${s.product_id}`}
                        className="flex-1 font-semibold text-text-primary hover:text-accent"
                      >
                        {p?.name ?? s.product_id}
                      </Link>
                      <span className="text-caption text-text-secondary tnum">
                        {s.on_hand} left
                      </span>
                      <Badge tone="warning">low</Badge>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  badge,
  hint,
}: {
  label: string;
  value: string;
  badge?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-text-secondary">{label}</span>
      <span className="inline-flex items-center gap-2 text-h2 font-bold tnum">
        {value}
        {badge ? <Badge tone="warning">!</Badge> : null}
        {hint ? <span className="text-overline uppercase text-text-disabled">{hint}</span> : null}
      </span>
    </div>
  );
}
