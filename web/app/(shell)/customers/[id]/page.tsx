import Link from 'next/link';
import { Badge, Card, ErrorCard } from '@/components/ui';
import { tenantGet } from '@/lib/tenant-api';
import { ApiError } from '@/lib/api';
import { EditCustomerForm } from '@/components/customers/EditCustomerForm';
import { formatMoney, type CustomerDetail } from '@/lib/models';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let customer: CustomerDetail;
  try {
    customer = await tenantGet<CustomerDetail>(`/customers/${id}`);
  } catch (e) {
    const code = e instanceof ApiError ? e.code : 'not_found';
    const message = e instanceof ApiError ? e.message : 'Could not load this customer.';
    return <ErrorCard code={code} title={message} />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/customers" className="text-caption text-accent">
          ← Customers
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-h1 font-bold">{customer.name}</h1>
          {customer.disabled ? <Badge tone="neutral">inactive</Badge> : null}
        </div>
        <p className="text-caption text-text-secondary">
          {[customer.email, customer.phone].filter(Boolean).join(' · ') || 'No contact details'}
        </p>
      </div>

      <Card className="flex items-baseline justify-between">
        <span className="text-caption text-text-secondary">Outstanding balance</span>
        <span className="text-h2 font-bold tnum">
          {formatMoney(customer.outstanding_balance, 'TZS')}
        </span>
      </Card>

      <EditCustomerForm customer={customer} />

      <Card className="p-0">
        <h2 className="text-h3 font-semibold px-4 pt-4 pb-2">Recent invoices</h2>
        {customer.recent_invoices.length === 0 ? (
          <p className="text-caption text-text-secondary px-4 pb-4">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="text-caption text-text-secondary text-left">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Due</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {customer.recent_invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-surface-sunken">
                    <td className="px-4 py-2">
                      <Link href={`/invoices/${inv.id}`} className="text-accent font-semibold">
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-text-secondary">{inv.due_date.slice(0, 10)}</td>
                    <td className="px-4 py-2 text-right tnum">
                      {formatMoney(inv.total_minor, 'TZS')}
                    </td>
                    <td className="px-4 py-2 text-right tnum">
                      {formatMoney(inv.balance_due_minor, 'TZS')}
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        tone={
                          inv.status === 'paid'
                            ? 'success'
                            : inv.status === 'void'
                              ? 'neutral'
                              : 'warning'
                        }
                      >
                        {inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
