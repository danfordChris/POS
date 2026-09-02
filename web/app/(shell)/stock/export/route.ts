import { tenantGet } from '@/lib/tenant-api';
import type { Page, Product, StockItem } from '@/lib/models';

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(): Promise<Response> {
  let items: StockItem[];
  let products: Product[];
  try {
    [items, products] = await Promise.all([
      tenantGet<{ data: StockItem[] }>('/stock', { limit: 100 }).then((r) => r.data),
      tenantGet<Page<Product>>('/products', { limit: 100 }).then((r) => r.data),
    ]);
  } catch {
    return new Response('Could not export stock', { status: 502 });
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = [
    ['sku', 'name', 'on_hand', 'reorder_threshold', 'low_stock', 'updated_at'],
    ...items.map((s) => {
      const p = byId.get(s.product_id);
      return [
        p?.sku ?? s.product_id,
        p?.name ?? '',
        s.on_hand,
        s.reorder_threshold,
        s.low_stock ? 'yes' : 'no',
        s.updated_at,
      ];
    }),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="stock-${stamp}.csv"`,
    },
  });
}
