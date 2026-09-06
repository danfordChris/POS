import { TemplateRegistry } from './template-registry.js';
import type { LowStockVars } from './low-stock-vars.js';

const reg = new TemplateRegistry();

const single: LowStockVars = {
  business_name: 'Duka la Mama',
  catalog_url: 'https://app.example/catalog/p1',
  items: [{ product_name: 'Sukari 1kg', on_hand: 2, threshold: 6 }],
};
const digest: LowStockVars = {
  business_name: 'Duka la Mama',
  catalog_url: 'https://app.example/catalog',
  items: [
    { product_name: 'Sukari 1kg', on_hand: 2, threshold: 6 },
    { product_name: 'Mchele 2kg', on_hand: 0, threshold: 4 },
  ],
};

describe('TemplateRegistry — low_stock', () => {
  it('renders English copy for en', () => {
    const r = reg.render('low_stock', 'en', single);
    expect(r.subject).toBe('Low stock: Sukari 1kg');
    expect(r.text).toContain('running low');
    expect(r.text).toContain('reorder at 6');
    expect(r.text).toContain(single.catalog_url);
    expect(r.html).toContain('<li>');
  });

  it('renders Swahili copy for sw', () => {
    const r = reg.render('low_stock', 'sw', single);
    expect(r.subject).toContain('inakaribia kuisha');
    expect(r.text).toContain('inakaribia kuisha');
    expect(r.text).toContain('agiza upya');
    expect(r.text).toContain(single.catalog_url);
  });

  it('falls back to English for an unknown locale', () => {
    const r = reg.render('low_stock', 'fr', single);
    expect(r).toEqual(reg.render('low_stock', 'en', single));
  });

  it('single vs digest shape', () => {
    const one = reg.render('low_stock', 'en', single);
    const many = reg.render('low_stock', 'en', digest);
    expect(one.subject).toBe('Low stock: Sukari 1kg');
    expect(many.subject).toBe('Low stock: 2 products');
    for (const i of digest.items) {
      expect(many.text).toContain(i.product_name);
      expect(many.text).toContain(String(i.threshold));
    }
  });

  it('contains no secrets or internal URLs', () => {
    for (const locale of ['en', 'sw']) {
      for (const vars of [single, digest]) {
        const r = reg.render('low_stock', locale, vars);
        const blob = `${r.subject}\n${r.text}\n${r.html}`.toLowerCase();
        for (const bad of [
          'password',
          'token',
          'secret',
          'localhost:3007',
          'internal',
        ]) {
          expect(blob).not.toContain(bad);
        }
      }
    }
  });
});
