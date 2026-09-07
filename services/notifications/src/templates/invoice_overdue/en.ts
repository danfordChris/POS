import { htmlShell } from '../low-stock-vars.js';
import {
  money,
  type InvoiceOverdueTemplate,
  type InvoiceOverdueVars,
} from '../invoice-vars.js';

const lineText = (v: InvoiceOverdueVars): string[] =>
  v.invoices.map(
    (i) =>
      `#${i.number}: ${money(i.balance_due_minor, i.currency)} — due ${i.due_date} (${i.days_overdue} day${i.days_overdue === 1 ? '' : 's'} overdue)`,
  );

export const enInvoiceOverdue: InvoiceOverdueTemplate = {
  subject: (v: InvoiceOverdueVars): string =>
    v.audience === 'owner'
      ? `${v.invoices.length} overdue invoice${v.invoices.length === 1 ? '' : 's'} — ${v.business_name}`
      : `Overdue invoice${v.invoices.length === 1 ? '' : 's'} from ${v.business_name}`,

  text: (v: InvoiceOverdueVars): string =>
    [
      v.audience === 'owner'
        ? `${v.business_name}: ${v.invoices.length} invoice(s) are past due for ${v.customer_name ?? 'a customer'}.`
        : `${v.business_name} has invoice(s) that are now past due.`,
      '',
      ...lineText(v),
      '',
      `Total outstanding: ${money(v.total_outstanding_minor, v.invoices[0]?.currency ?? '')}`,
    ].join('\n'),

  html: (v: InvoiceOverdueVars): string =>
    htmlShell(
      v.audience === 'owner'
        ? `Overdue invoices — ${v.customer_name ?? 'customer'}`
        : `Overdue invoices from ${v.business_name}`,
      lineText(v),
      `Total outstanding: ${money(v.total_outstanding_minor, v.invoices[0]?.currency ?? '')}`,
    ),
};
