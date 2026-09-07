import Link from 'next/link';
import { Badge, Card, ErrorCard } from '@/components/ui';
import { getSession } from '@/lib/session';
import { tenantGet } from '@/lib/tenant-api';
import { ApiError } from '@/lib/api';
import { API_BASE } from '@/lib/api';
import { RecordPaymentForm } from '@/components/invoices/RecordPaymentForm';
import { VoidInvoiceButton } from '@/components/invoices/VoidInvoiceButton';
import { PdfDownloadButton } from '@/components/invoices/PdfDownloadButton';
import { formatMoney, type Invoice } from '@/lib/models';

function statusTone(s: string): 'success' | 'warning' | 'neutral' {
  if (s === 'paid') return 'success';
  if (s === 'void') return 'neutral';
  return 'warning';
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  let inv: Invoice;
  try {
    inv = await tenantGet<Invoice>(`/invoices/${id}`);
  } catch (e) {
    const code = e instanceof ApiError ? e.code : 'not_found';
    const message = e instanceof ApiError ? e.message : 'Could not load this invoice.';
    return <ErrorCard code={code} title={message} />;
  }

  const open = inv.status !== 'paid' && inv.status !== 'void';
  const pdfUrl = `${API_BASE}/v1/i/${inv.public_token}/pdf`;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/invoices" className="text-caption text-accent">
          ← Invoices
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-h1 font-bold">Invoice #{inv.number}</h1>
          <Badge tone={statusTone(inv.status)}>{inv.status.replace('_', ' ')}</Badge>
        </div>
        <p className="text-caption text-text-secondary">
          <Link href={`/customers/${inv.customer_id}`} className="text-accent">
            {inv.customer_name}
          </Link>
          {' · issued '}
          {inv.issue_date.slice(0, 10)} · due {inv.due_date.slice(0, 10)}
          {inv.sale_id ? (
            <>
              {' · '}
              <Link href={`/sales/${inv.sale_id}`} className="text-accent">
                from a sale
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="text-caption text-text-secondary text-left">
                <th className="py-1 pr-4">Description</th>
                <th className="py-1 pr-4 text-right">Unit</th>
                <th className="py-1 pr-4 text-right">Qty</th>
                <th className="py-1 pr-4 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.id} className="border-t border-surface-sunken">
                  <td className="py-1 pr-4">{l.description}</td>
                  <td className="py-1 pr-4 text-right">
                    {formatMoney(l.unit_price_minor, inv.currency)}
                  </td>
                  <td className="py-1 pr-4 text-right">{l.quantity}</td>
                  <td className="py-1 pr-4 text-right">
                    {formatMoney(l.line_total_minor, inv.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-end gap-1 text-body">
          <span className="text-text-secondary">
            Subtotal {formatMoney(inv.subtotal_minor, inv.currency)}
          </span>
          {inv.discount_minor > 0 ? (
            <span className="text-text-secondary">
              Discount -{formatMoney(inv.discount_minor, inv.currency)}
            </span>
          ) : null}
          <span className="text-h3 font-bold">
            Total {formatMoney(inv.total_minor, inv.currency)}
          </span>
          <span className="text-text-secondary">
            Paid {formatMoney(inv.amount_paid_minor, inv.currency)}
          </span>
          <span className="text-h3 font-bold">
            Balance due {formatMoney(inv.balance_due_minor, inv.currency)}
          </span>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <PdfDownloadButton url={pdfUrl} />
        <a
          href={`${API_BASE}/v1/i/${inv.public_token}`}
          target="_blank"
          rel="noreferrer"
          className="text-accent font-semibold text-caption"
        >
          Public link ↗
        </a>
      </div>

      {inv.payments.length > 0 ? (
        <Card className="p-0">
          <h2 className="text-h3 font-semibold px-4 pt-4 pb-2">Payments</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <tbody>
                {inv.payments.map((p) => (
                  <tr key={p.id} className="border-t border-surface-sunken">
                    <td className="px-4 py-2 text-text-secondary">{p.received_at.slice(0, 10)}</td>
                    <td className="px-4 py-2">{p.method.replace('_', ' ')}</td>
                    <td className="px-4 py-2 text-text-secondary">{p.reference ?? ''}</td>
                    <td className="px-4 py-2 text-right tnum">
                      {formatMoney(p.amount_minor, inv.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {open ? (
        <RecordPaymentForm
          invoiceId={inv.id}
          balanceDue={inv.balance_due_minor}
          currency={inv.currency}
        />
      ) : null}

      {session?.role === 'owner' && inv.status !== 'paid' && inv.status !== 'void' ? (
        <div className="ml-auto">
          <VoidInvoiceButton invoiceId={inv.id} />
        </div>
      ) : null}
    </div>
  );
}
