import {
  htmlShell,
  type LowStockItem,
  type LowStockTemplate,
  type LowStockVars,
} from '../low-stock-vars.js';

const line = (i: LowStockItem): string =>
  `${i.product_name}: ${i.on_hand} on hand, reorder at ${i.threshold}`;

export const enLowStock: LowStockTemplate = {
  subject: (v: LowStockVars): string =>
    v.items.length === 1
      ? `Low stock: ${v.items[0].product_name}`
      : `Low stock: ${v.items.length} products`,

  text: (v: LowStockVars): string => {
    const heading =
      v.items.length === 1
        ? `${v.business_name}: a product is running low.`
        : `${v.business_name}: ${v.items.length} products are running low.`;
    return [
      heading,
      '',
      ...v.items.map((i) => `- ${line(i)}`),
      '',
      `View catalog: ${v.catalog_url}`,
    ].join('\n');
  },

  html: (v: LowStockVars): string => {
    const heading =
      v.items.length === 1
        ? `${v.business_name}: a product is running low`
        : `${v.business_name}: ${v.items.length} products are running low`;
    return htmlShell(
      heading,
      v.items.map(line),
      `View catalog: ${v.catalog_url}`,
    );
  },
};
