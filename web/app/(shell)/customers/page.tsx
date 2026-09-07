import Link from 'next/link';
import { UserSquare2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorCard } from '@/components/ui';
import { tenantGet } from '@/lib/tenant-api';
import { ApiError } from '@/lib/api';
import { NewCustomerForm } from '@/components/customers/NewCustomerForm';
import { formatMoney, type Customer, type Page } from '@/lib/models';

type SP = Record<string, string | string[] | undefined>;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const hasBalance = sp.has_balance === 'true';
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : undefined;

  let customers: Page<Customer>;
  try {
    customers = await tenantGet<Page<Customer>>('/customers', {
      q,
      has_balance: hasBalance ? 'true' : undefined,
      cursor,
      limit: 25,
    });
  } catch (e) {
    const code = e instanceof ApiError ? e.code : 'load_failed';
    const message = e instanceof ApiError ? e.message : 'Could not load customers.';
    return <ErrorCard code={code} title={message} />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-h1 font-bold">Customers</h1>
        <p className="text-body text-text-secondary mt-1">
          Trade customers you invoice on account.
        </p>
      </div>

      <NewCustomerForm />

      <div className="flex items-center gap-3">
        <form className="flex-1" action="/customers">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, phone or email"
            className="w-full rounded-lg border border-surface-sunken bg-surface px-3 py-2 text-body"
            aria-label="Search customers"
          />
        </form>
        <Link
          href={hasBalance ? '/customers' : '/customers?has_balance=true'}
          className="text-caption font-semibold text-accent"
        >
          {hasBalance ? 'Show all' : 'Owes money only'}
        </Link>
      </div>

      {customers.data.length === 0 ? (
        <EmptyState
          icon={<UserSquare2 />}
          title="No customers"
          description="Add a customer above, then invoice them on account."
        />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="text-caption text-text-secondary text-left">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.data.map((c) => (
                  <tr key={c.id} className="border-t border-surface-sunken">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`} className="text-accent font-semibold">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{c.email ?? c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right tnum">
                      {c.outstanding_balance > 0 ? formatMoney(c.outstanding_balance, 'TZS') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {c.disabled ? (
                        <Badge tone="neutral">inactive</Badge>
                      ) : (
                        <Badge tone="success">active</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {customers.next_cursor ? (
        <Link href={{ pathname: '/customers', query: { cursor: customers.next_cursor } }}>
          <Button variant="secondary">Load more</Button>
        </Link>
      ) : null}
    </div>
  );
}
