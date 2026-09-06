export interface LowStockItem {
  product_name: string;
  on_hand: number;
  threshold: number;
}

export interface LowStockVars {
  business_name: string;
  /** Single item → that product's page; digest → the catalog list. */
  catalog_url: string;
  items: LowStockItem[];
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface LowStockTemplate {
  subject(vars: LowStockVars): string;
  text(vars: LowStockVars): string;
  html(vars: LowStockVars): string;
}

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[c] ?? c;
  });

/** Shared HTML skeleton — each locale supplies copy only, not markup. */
export const htmlShell = (
  heading: string,
  itemLines: string[],
  cta: string,
): string =>
  [
    '<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">',
    `<h2 style="font-size:16px;margin:0 0 8px">${escapeHtml(heading)}</h2>`,
    '<ul style="padding-left:18px;margin:0 0 12px">',
    ...itemLines.map((l) => `<li>${escapeHtml(l)}</li>`),
    '</ul>',
    `<p>${escapeHtml(cta)}</p>`,
    '</div>',
  ].join('');
