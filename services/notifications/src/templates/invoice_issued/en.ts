import { noticeHtml } from '../winger-authorized-vars.js';
import {
  money,
  type InvoiceIssuedTemplate,
  type InvoiceIssuedVars,
} from '../invoice-vars.js';

export const enInvoiceIssued: InvoiceIssuedTemplate = {
  subject: (v: InvoiceIssuedVars): string =>
    `Invoice #${v.number} from ${v.business_name}`,

  text: (v: InvoiceIssuedVars): string =>
    [
      `${v.business_name} has issued you invoice #${v.number}.`,
      '',
      `Total: ${money(v.total_minor, v.currency)}`,
      `Balance due: ${money(v.balance_due_minor, v.currency)}`,
      `Due by: ${v.due_date}`,
      '',
      `View the invoice: ${v.invoice_url}`,
    ].join('\n'),

  html: (v: InvoiceIssuedVars): string =>
    noticeHtml(
      `Invoice #${v.number} from ${v.business_name}`,
      `Balance due ${money(v.balance_due_minor, v.currency)} (total ${money(v.total_minor, v.currency)}), due by ${v.due_date}.`,
      `View the invoice: ${v.invoice_url}`,
    ),
};
