import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorCard } from '@/components/ui';
import { tenantGet } from '@/lib/tenant-api';
import { ApiError } from '@/lib/api';
import { formatMoney, type InvoiceSummary, type Page } from '@/lib/models';

type SP = Record<string, string | string[] | undefined>;

const STATUSES = ['issued', 'partially_paid', 'paid', 'void'];

function statusTone(s: string): 'success' | 'warning' | 'neutral' | 'danger' {
  if (s === 'paid') return 'success';
  if (s === 'void') return 'neutral';
  if (s === 'partially_paid') return 'warning';
  return 'warning';
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const status =
    typeof sp.status === 'string' && STATUSES.includes(sp.status) ? sp.status : undefined;
  const overdue = sp.overdue === 'true';
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : undefined;

  let invoices: Page<InvoiceSummary>;
  try {
    invoices = await tenantGet<Page<InvoiceSummary>>('/invoices', {
      status,
      overdue: overdue ? 'true' : undefined,
      cursor,
      limit: 25,
    });
  } catch (e) {
    const code = e instanceof ApiError ? e.code : 'load_failed';
    const message = e instanceof ApiError ? e.message : 'Could not load invoices.';
    return <ErrorCard code={code} title={message} />;
  }

  const filterHref = (patch: Record<string, string | undefined>) => {
    const q: Record<string, string> = {};
    if (status && patch.status === undefined) q.status = status;
    if (overdue && patch.overdue === undefined) q.overdue = 'true';
    for (const [k, v] of Object.entries(patch)) if (v) q[k] = v;
    return { pathname: '/invoices', query: q };
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-bold">Invoices</h1>
        <p className="text-body text-text-secondary mt-1">{invoices.data.length} shown</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-caption">
        <Link href="/invoices" className="font-semibold text-accent">
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={filterHref({ status: s, overdue: undefined })}
            className={s === status ? 'font-semibold text-text-primary' : 'text-text-secondary'}
          >
            {s.replace('_', ' ')}
          </Link>
        ))}
        <Link
          href={overdue ? filterHref({ overdue: undefined }) : filterHref({ overdue: 'true' })}
          className={overdue ? 'font-semibold text-danger' : 'text-text-secondary'}
        >
          overdue
        </Link>
      </div>

      {invoices.data.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No invoices"
          description="Sell to a customer on credit, or raise a standalone invoice from a sale."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="text-caption text-text-secondary text-left">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Due</th>
                <th className="py-2 pr-4 text-right">Total</th>
                <th className="py-2 pr-4 text-right">Balance</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.data.map((inv) => (
                <tr key={inv.id} className="border-t border-surface-sunken">
                  <td className="py-2 pr-4">
                    <Link href={`/invoices/${inv.id}`} className="text-accent font-semibold">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{inv.customer_name}</td>
                  <td className="py-2 pr-4 text-text-secondary">{inv.due_date.slice(0, 10)}</td>
                  <td className="py-2 pr-4 text-right tnum">
                    {formatMoney(inv.total_minor, inv.currency)}
                  </td>
                  <td className="py-2 pr-4 text-right tnum">
                    {formatMoney(inv.balance_due_minor, inv.currency)}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge tone={statusTone(inv.status)}>{inv.status.replace('_', ' ')}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invoices.next_cursor ? (
        <Link href={filterHref({ cursor: invoices.next_cursor })}>
          <Button variant="secondary">Load more</Button>
        </Link>
      ) : null}
    </div>
  );
}
