import { htmlShell } from '../low-stock-vars.js';
import {
  money,
  type InvoiceOverdueTemplate,
  type InvoiceOverdueVars,
} from '../invoice-vars.js';

const lineText = (v: InvoiceOverdueVars): string[] =>
  v.invoices.map(
    (i) =>
      `#${i.number}: ${money(i.balance_due_minor, i.currency)} — ilipaswa ${i.due_date} (imechelewa siku ${i.days_overdue})`,
  );

export const swInvoiceOverdue: InvoiceOverdueTemplate = {
  subject: (v: InvoiceOverdueVars): string =>
    v.audience === 'owner'
      ? `Ankara ${v.invoices.length} zimechelewa — ${v.business_name}`
      : `Ankara zilizochelewa kutoka ${v.business_name}`,

  text: (v: InvoiceOverdueVars): string =>
    [
      v.audience === 'owner'
        ? `${v.business_name}: ankara ${v.invoices.length} za ${v.customer_name ?? 'mteja'} zimepitwa na muda.`
        : `${v.business_name} ina ankara zilizopitwa na muda wa kulipa.`,
      '',
      ...lineText(v),
      '',
      `Jumla ya deni: ${money(v.total_outstanding_minor, v.invoices[0]?.currency ?? '')}`,
    ].join('\n'),

  html: (v: InvoiceOverdueVars): string =>
    htmlShell(
      v.audience === 'owner'
        ? `Ankara zilizochelewa — ${v.customer_name ?? 'mteja'}`
        : `Ankara zilizochelewa kutoka ${v.business_name}`,
      lineText(v),
      `Jumla ya deni: ${money(v.total_outstanding_minor, v.invoices[0]?.currency ?? '')}`,
    ),
};
