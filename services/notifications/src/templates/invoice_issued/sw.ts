import { noticeHtml } from '../winger-authorized-vars.js';
import {
  money,
  type InvoiceIssuedTemplate,
  type InvoiceIssuedVars,
} from '../invoice-vars.js';

export const swInvoiceIssued: InvoiceIssuedTemplate = {
  subject: (v: InvoiceIssuedVars): string =>
    `Ankara #${v.number} kutoka ${v.business_name}`,

  text: (v: InvoiceIssuedVars): string =>
    [
      `${v.business_name} imekutumia ankara #${v.number}.`,
      '',
      `Jumla: ${money(v.total_minor, v.currency)}`,
      `Deni lililobaki: ${money(v.balance_due_minor, v.currency)}`,
      `Lipa kabla ya: ${v.due_date}`,
      '',
      `Angalia ankara: ${v.invoice_url}`,
    ].join('\n'),

  html: (v: InvoiceIssuedVars): string =>
    noticeHtml(
      `Ankara #${v.number} kutoka ${v.business_name}`,
      `Deni lililobaki ${money(v.balance_due_minor, v.currency)} (jumla ${money(v.total_minor, v.currency)}), lipa kabla ya ${v.due_date}.`,
      `Angalia ankara: ${v.invoice_url}`,
    ),
};
