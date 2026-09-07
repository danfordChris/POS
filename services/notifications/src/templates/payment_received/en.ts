import { noticeHtml } from '../winger-authorized-vars.js';
import {
  money,
  type PaymentReceivedTemplate,
  type PaymentReceivedVars,
} from '../invoice-vars.js';

export const enPaymentReceived: PaymentReceivedTemplate = {
  subject: (v: PaymentReceivedVars): string =>
    v.paid_in_full
      ? `Invoice #${v.number} paid in full`
      : `Payment received for invoice #${v.number}`,

  text: (v: PaymentReceivedVars): string =>
    [
      `${v.business_name} received your payment of ${money(v.amount_minor, v.currency)} for invoice #${v.number}.`,
      '',
      v.paid_in_full
        ? 'This invoice is now paid in full. Thank you.'
        : `Balance still due: ${money(v.balance_due_minor, v.currency)}`,
    ].join('\n'),

  html: (v: PaymentReceivedVars): string =>
    noticeHtml(
      `Payment received — invoice #${v.number}`,
      `${v.business_name} received ${money(v.amount_minor, v.currency)}.`,
      v.paid_in_full
        ? 'This invoice is now paid in full. Thank you.'
        : `Balance still due: ${money(v.balance_due_minor, v.currency)}`,
    ),
};
