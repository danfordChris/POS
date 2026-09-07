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

  it('renders winger_authorized in en and sw with the portal link', () => {
    const vars = {
      business_name: 'Duka la Mama',
      portal_url: 'https://app.example/winger',
    };
    const en = reg.renderWingerAuthorized('en', vars);
    expect(en.subject).toBe('You can now sell for Duka la Mama');
    expect(en.text).toContain('authorized you as a reseller');
    expect(en.text).toContain(vars.portal_url);
    expect(en.html).toContain(vars.portal_url);

    const sw = reg.renderWingerAuthorized('sw', vars);
    expect(sw.subject).toContain('Sasa unaweza kuuza');
    expect(sw.text).toContain('amekuidhinisha');
    expect(sw.text).toContain(vars.portal_url);

    // unknown locale → en
    expect(reg.renderWingerAuthorized('fr', vars)).toEqual(
      reg.renderWingerAuthorized('en', vars),
    );
  });

  it('renders invitation in en and sw with the accept link', () => {
    const vars = {
      business_name: 'Duka la Mama',
      accept_url: 'https://app.example/invitations/accept?token=abc',
    };
    const en = reg.renderInvitation('en', vars);
    expect(en.subject).toBe('Join Duka la Mama on Stoki');
    expect(en.text).toContain('invited to join Duka la Mama');
    expect(en.text).toContain(vars.accept_url);
    expect(en.html).toContain(vars.accept_url);

    const sw = reg.renderInvitation('sw', vars);
    expect(sw.subject).toContain('Jiunge na Duka la Mama');
    expect(sw.text).toContain('Umealikwa');
    expect(sw.text).toContain(vars.accept_url);

    expect(reg.renderInvitation('fr', vars)).toEqual(
      reg.renderInvitation('en', vars),
    );
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

describe('TemplateRegistry — invoicing (Phase 07)', () => {
  const issued = {
    business_name: 'Duka la Asha',
    customer_name: 'Bakari Traders',
    number: 42,
    currency: 'TZS',
    total_minor: 30000,
    balance_due_minor: 30000,
    due_date: '2026-09-21',
    invoice_url: 'https://app.example/i/tok_abc',
  };

  it('renders invoice_issued en/sw and falls back to en', () => {
    const en = reg.renderInvoiceIssued('en', issued);
    expect(en.subject).toBe('Invoice #42 from Duka la Asha');
    expect(en.text).toContain(issued.invoice_url);
    expect(en.text).toContain('TZS 30,000');

    const sw = reg.renderInvoiceIssued('sw', issued);
    expect(sw.subject).toContain('Ankara #42');
    expect(sw.text).toContain('Deni lililobaki');

    expect(reg.renderInvoiceIssued('fr', issued)).toEqual(en);
  });

  it('renders payment_received with a paid-in-full line', () => {
    const partial = reg.renderPaymentReceived('en', {
      business_name: 'Duka la Asha',
      number: 42,
      currency: 'TZS',
      amount_minor: 10000,
      balance_due_minor: 20000,
      paid_in_full: false,
    });
    expect(partial.text).toContain('Balance still due: TZS 20,000');

    const full = reg.renderPaymentReceived('sw', {
      business_name: 'Duka la Asha',
      number: 42,
      currency: 'TZS',
      amount_minor: 20000,
      balance_due_minor: 0,
      paid_in_full: true,
    });
    expect(full.subject).toContain('imelipwa yote');
  });

  it('renders invoice_overdue for customer + owner audiences', () => {
    const lines = [
      {
        number: 1,
        currency: 'TZS',
        balance_due_minor: 5000,
        due_date: '2026-09-01',
        days_overdue: 6,
      },
    ];
    const cust = reg.renderInvoiceOverdue('en', {
      business_name: 'Duka la Asha',
      audience: 'customer',
      invoices: lines,
      total_outstanding_minor: 5000,
    });
    expect(cust.subject).toContain('Overdue invoice');
    expect(cust.text).toContain('6 days overdue');

    const owner = reg.renderInvoiceOverdue('en', {
      business_name: 'Duka la Asha',
      audience: 'owner',
      customer_name: 'Bakari Traders',
      invoices: lines,
      total_outstanding_minor: 5000,
    });
    expect(owner.subject).toContain('1 overdue invoice');
    expect(owner.text).toContain('Bakari Traders');
  });
});
