import { getSession } from '@/lib/session';
import { tenantGet } from '@/lib/tenant-api';
import type {
  Category,
  Page,
  Product,
  Sale,
  SaleSummary,
  StockItem,
  WingerAccount,
} from '@/lib/models';

// Bounded so one business's export can't fan out unbounded work. A retailer
// well past these limits should ask for a database-level export instead.
const MAX_PRODUCTS = 2000;
const MAX_SALES = 1000;

/**
 * Owner-only, tenant-scoped business data export. Assembled from the same
 * per-service read endpoints the app uses — every call goes through Kong with
 * the caller's own token, so RLS + membership scope it to their business.
 */
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (session?.role !== 'owner') {
    return Response.json(
      { error: { code: 'forbidden', message: 'Only an Owner can export business data.' } },
      { status: 403 },
    );
  }

  try {
    const [products, categories, stock] = await Promise.all([
      tenantGet<Page<Product>>('/products', { limit: 100 }).then((p) =>
        drain(
          p,
          (cursor) => tenantGet<Page<Product>>('/products', { limit: 100, cursor }),
          MAX_PRODUCTS,
        ),
      ),
      tenantGet<Category[]>('/categories'),
      tenantGet<{ data: StockItem[] }>('/stock', { limit: 500 }).then((r) => r.data),
    ]);

    let saleSummaries = await tenantGet<Page<SaleSummary>>('/sales', { limit: 100 }).then((p) =>
      drain(
        p,
        (cursor) => tenantGet<Page<SaleSummary>>('/sales', { limit: 100, cursor }),
        MAX_SALES,
      ),
    );
    const truncatedSales = saleSummaries.length >= MAX_SALES;
    saleSummaries = saleSummaries.slice(0, MAX_SALES);
    // Pull full detail (with lines) for each sale.
    const sales: Sale[] = [];
    for (const s of saleSummaries) {
      sales.push(await tenantGet<Sale>(`/sales/${s.id}`));
    }

    const winger_accounts = await tenantGet<WingerAccount[]>('/winger-accounts');

    const body = {
      exported_at: new Date().toISOString(),
      business: { id: session.businessId, name: session.businessName },
      limits: { max_products: MAX_PRODUCTS, max_sales: MAX_SALES },
      truncated: {
        products: products.length >= MAX_PRODUCTS,
        sales: truncatedSales,
      },
      products,
      categories,
      stock,
      sales,
      winger_accounts,
    };

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="business-export-${stamp}.json"`,
      },
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return Response.json(
      {
        error: {
          code: err.code ?? 'export_failed',
          message: err.message ?? 'Could not build the export.',
        },
      },
      { status: 502 },
    );
  }
}

async function drain<T>(
  first: Page<T>,
  next: (cursor: string) => Promise<Page<T>>,
  cap: number,
): Promise<T[]> {
  const out = [...first.data];
  let cursor = first.next_cursor;
  while (cursor && out.length < cap) {
    const page = await next(cursor);
    out.push(...page.data);
    cursor = page.next_cursor;
  }
  return out.slice(0, cap);
}
