import Link from 'next/link';
import { Badge, Card, ErrorCard } from '@/components/ui';
import { VoidSaleButton } from '@/components/sales/VoidSaleButton';
import { getSession } from '@/lib/session';
import { tenantGet } from '@/lib/tenant-api';
import type { Sale } from '@/lib/models';
import { formatMoney } from '@/lib/models';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8000';

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  let sale: Sale;
  try {
    sale = await tenantGet<Sale>(`/sales/${id}`);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return (
      <ErrorCard
        code={err.code ?? 'not_found'}
        title="Could not load this sale"
        body={err.message}
      />
    );
  }

  const receiptUrl = sale.receipt ? `${API_BASE}/v1/r/${sale.receipt.public_token}` : null;
  const voided = sale.status === 'voided';

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/sales" className="text-caption text-accent">
          ← Sales
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-h1 font-bold">Sale #{sale.number}</h1>
          <Badge tone={voided ? 'danger' : 'success'}>{sale.status}</Badge>
        </div>
        <p className="text-caption text-text-secondary">
          {new Date(sale.created_at).toLocaleString()}
          {sale.customer_label ? ` · ${sale.customer_label}` : ''}
          {voided && sale.voided_at ? ` · voided ${new Date(sale.voided_at).toLocaleString()}` : ''}
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="text-caption text-text-secondary text-left">
                <th className="py-1 pr-4">Item</th>
                <th className="py-1 pr-4 text-right">Unit</th>
                <th className="py-1 pr-4 text-right">Qty</th>
                <th className="py-1 pr-4 text-right">Discount</th>
                <th className="py-1 pr-4 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {sale.lines.map((l) => (
                <tr key={l.product_id} className="border-t border-surface-sunken">
                  <td className="py-1 pr-4">{l.name}</td>
                  <td className="py-1 pr-4 text-right">
                    {formatMoney(l.unit_price, sale.currency)}
                  </td>
                  <td className="py-1 pr-4 text-right">{l.quantity}</td>
                  <td className="py-1 pr-4 text-right">
                    {l.discount ? `-${formatMoney(l.discount, sale.currency)}` : '—'}
                  </td>
                  <td className="py-1 pr-4 text-right">
                    {formatMoney(l.line_total, sale.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-end gap-1 text-body">
          <span className="text-text-secondary">
            Subtotal {formatMoney(sale.subtotal, sale.currency)}
          </span>
          <span className="text-text-secondary">
            Discount -{formatMoney(sale.discount_total, sale.currency)}
          </span>
          <span className="text-h3 font-bold">Total {formatMoney(sale.total, sale.currency)}</span>
        </div>
      </Card>

      <div className="flex items-center gap-4">
        {receiptUrl ? (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent font-semibold text-body"
          >
            View public receipt ↗
          </a>
        ) : null}
        {session?.role === 'owner' ? (
          <div className="ml-auto">
            <VoidSaleButton saleId={sale.id} disabled={voided} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
