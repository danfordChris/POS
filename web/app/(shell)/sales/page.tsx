import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorCard } from '@/components/ui';
import { tenantGet } from '@/lib/tenant-api';
import type { Page, SaleSummary } from '@/lib/models';
import { formatMoney } from '@/lib/models';

type SP = Record<string, string | string[] | undefined>;

export default async function SalesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : undefined;

  let sales: Page<SaleSummary>;
  try {
    sales = await tenantGet<Page<SaleSummary>>('/sales', { cursor, limit: 25 });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return (
      <ErrorCard code={err.code ?? 'load_failed'} title="Could not load sales" body={err.message} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-bold">Sales</h1>
        <p className="text-body text-text-secondary mt-1">{sales.data.length} shown</p>
      </div>

      {sales.data.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="No sales yet"
          description="Completed sales from the mobile app show up here."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="text-caption text-text-secondary text-left">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Lines</th>
                <th className="py-2 pr-4 text-right">Total</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.data.map((s) => (
                <tr key={s.id} className="border-t border-surface-sunken">
                  <td className="py-2 pr-4">
                    <Link href={`/sales/${s.id}`} className="text-accent font-semibold">
                      {s.number}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-text-secondary">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">{s.line_count}</td>
                  <td className="py-2 pr-4 text-right">{formatMoney(s.total, s.currency)}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={s.status === 'voided' ? 'danger' : 'success'}>{s.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sales.next_cursor ? (
        <div>
          <Link href={{ pathname: '/sales', query: { cursor: sales.next_cursor } }}>
            <Button variant="secondary">Load more</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
