import {
  htmlShell,
  type LowStockItem,
  type LowStockTemplate,
  type LowStockVars,
} from '../low-stock-vars.js';

const line = (i: LowStockItem): string =>
  `${i.product_name}: zilizopo ${i.on_hand}, agiza upya ukifikia ${i.threshold}`;

export const swLowStock: LowStockTemplate = {
  subject: (v: LowStockVars): string =>
    v.items.length === 1
      ? `Bidhaa inakaribia kuisha: ${v.items[0].product_name}`
      : `Bidhaa ${v.items.length} zinakaribia kuisha`,

  text: (v: LowStockVars): string => {
    const heading =
      v.items.length === 1
        ? `${v.business_name}: bidhaa moja inakaribia kuisha.`
        : `${v.business_name}: bidhaa ${v.items.length} zinakaribia kuisha.`;
    return [
      heading,
      '',
      ...v.items.map((i) => `- ${line(i)}`),
      '',
      `Angalia orodha ya bidhaa: ${v.catalog_url}`,
    ].join('\n');
  },

  html: (v: LowStockVars): string => {
    const heading =
      v.items.length === 1
        ? `${v.business_name}: bidhaa moja inakaribia kuisha`
        : `${v.business_name}: bidhaa ${v.items.length} zinakaribia kuisha`;
    return htmlShell(
      heading,
      v.items.map(line),
      `Angalia orodha ya bidhaa: ${v.catalog_url}`,
    );
  },
};
