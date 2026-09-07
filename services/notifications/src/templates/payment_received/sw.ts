import { noticeHtml } from '../winger-authorized-vars.js';
import {
  money,
  type PaymentReceivedTemplate,
  type PaymentReceivedVars,
} from '../invoice-vars.js';

export const swPaymentReceived: PaymentReceivedTemplate = {
  subject: (v: PaymentReceivedVars): string =>
    v.paid_in_full
      ? `Ankara #${v.number} imelipwa yote`
      : `Malipo yamepokelewa kwa ankara #${v.number}`,

  text: (v: PaymentReceivedVars): string =>
    [
      `${v.business_name} imepokea malipo yako ya ${money(v.amount_minor, v.currency)} kwa ankara #${v.number}.`,
      '',
      v.paid_in_full
        ? 'Ankara hii sasa imelipwa yote. Asante.'
        : `Deni lililobaki: ${money(v.balance_due_minor, v.currency)}`,
    ].join('\n'),

  html: (v: PaymentReceivedVars): string =>
    noticeHtml(
      `Malipo yamepokelewa — ankara #${v.number}`,
      `${v.business_name} imepokea ${money(v.amount_minor, v.currency)}.`,
      v.paid_in_full
        ? 'Ankara hii sasa imelipwa yote. Asante.'
        : `Deni lililobaki: ${money(v.balance_due_minor, v.currency)}`,
    ),
};
