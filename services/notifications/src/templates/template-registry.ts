import { Injectable } from '@nestjs/common';
import type {
  LowStockTemplate,
  LowStockVars,
  RenderedEmail,
} from './low-stock-vars.js';
import { enLowStock } from './low_stock/en.js';
import { swLowStock } from './low_stock/sw.js';
import type {
  WingerAuthorizedTemplate,
  WingerAuthorizedVars,
} from './winger-authorized-vars.js';
import { enWingerAuthorized } from './winger_authorized/en.js';
import { swWingerAuthorized } from './winger_authorized/sw.js';
import type { InvitationTemplate, InvitationVars } from './invitation-vars.js';
import { enInvitation } from './invitation/en.js';
import { swInvitation } from './invitation/sw.js';
import type {
  InvoiceIssuedTemplate,
  InvoiceIssuedVars,
  InvoiceOverdueTemplate,
  InvoiceOverdueVars,
  PaymentReceivedTemplate,
  PaymentReceivedVars,
} from './invoice-vars.js';
import { enInvoiceIssued } from './invoice_issued/en.js';
import { swInvoiceIssued } from './invoice_issued/sw.js';
import { enPaymentReceived } from './payment_received/en.js';
import { swPaymentReceived } from './payment_received/sw.js';
import { enInvoiceOverdue } from './invoice_overdue/en.js';
import { swInvoiceOverdue } from './invoice_overdue/sw.js';

const LOW_STOCK: Record<string, LowStockTemplate> = {
  en: enLowStock,
  sw: swLowStock,
};

const WINGER_AUTHORIZED: Record<string, WingerAuthorizedTemplate> = {
  en: enWingerAuthorized,
  sw: swWingerAuthorized,
};

const INVITATION: Record<string, InvitationTemplate> = {
  en: enInvitation,
  sw: swInvitation,
};

const INVOICE_ISSUED: Record<string, InvoiceIssuedTemplate> = {
  en: enInvoiceIssued,
  sw: swInvoiceIssued,
};

const PAYMENT_RECEIVED: Record<string, PaymentReceivedTemplate> = {
  en: enPaymentReceived,
  sw: swPaymentReceived,
};

const INVOICE_OVERDUE: Record<string, InvoiceOverdueTemplate> = {
  en: enInvoiceOverdue,
  sw: swInvoiceOverdue,
};

/** Renders localized email bodies. Copy lives in the per-locale template
 * modules; this only resolves the locale (unknown → `en`) and picks. */
@Injectable()
export class TemplateRegistry {
  render(
    type: 'low_stock',
    locale: string | null | undefined,
    vars: LowStockVars,
  ): RenderedEmail {
    if (type !== 'low_stock') {
      throw new Error(`no template for "${type}"`);
    }
    const tpl = LOW_STOCK[locale ?? ''] ?? LOW_STOCK.en;
    return {
      subject: tpl.subject(vars),
      text: tpl.text(vars),
      html: tpl.html(vars),
    };
  }

  renderWingerAuthorized(
    locale: string | null | undefined,
    vars: WingerAuthorizedVars,
  ): RenderedEmail {
    const tpl = WINGER_AUTHORIZED[locale ?? ''] ?? WINGER_AUTHORIZED.en;
    return {
      subject: tpl.subject(vars),
      text: tpl.text(vars),
      html: tpl.html(vars),
    };
  }

  renderInvitation(
    locale: string | null | undefined,
    vars: InvitationVars,
  ): RenderedEmail {
    const tpl = INVITATION[locale ?? ''] ?? INVITATION.en;
    return {
      subject: tpl.subject(vars),
      text: tpl.text(vars),
      html: tpl.html(vars),
    };
  }

  renderInvoiceIssued(
    locale: string | null | undefined,
    vars: InvoiceIssuedVars,
  ): RenderedEmail {
    const tpl = INVOICE_ISSUED[locale ?? ''] ?? INVOICE_ISSUED.en;
    return {
      subject: tpl.subject(vars),
      text: tpl.text(vars),
      html: tpl.html(vars),
    };
  }

  renderPaymentReceived(
    locale: string | null | undefined,
    vars: PaymentReceivedVars,
  ): RenderedEmail {
    const tpl = PAYMENT_RECEIVED[locale ?? ''] ?? PAYMENT_RECEIVED.en;
    return {
      subject: tpl.subject(vars),
      text: tpl.text(vars),
      html: tpl.html(vars),
    };
  }

  renderInvoiceOverdue(
    locale: string | null | undefined,
    vars: InvoiceOverdueVars,
  ): RenderedEmail {
    const tpl = INVOICE_OVERDUE[locale ?? ''] ?? INVOICE_OVERDUE.en;
    return {
      subject: tpl.subject(vars),
      text: tpl.text(vars),
      html: tpl.html(vars),
    };
  }
}
