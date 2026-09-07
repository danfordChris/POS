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

const LOW_STOCK: Record<string, LowStockTemplate> = {
  en: enLowStock,
  sw: swLowStock,
};

const WINGER_AUTHORIZED: Record<string, WingerAuthorizedTemplate> = {
  en: enWingerAuthorized,
  sw: swWingerAuthorized,
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
}
