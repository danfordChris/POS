import {
  EVENT_PAYLOADS,
  ERROR_CODES,
  SUBJECTS,
  evtSubject,
  internalContextSchema,
  messageEnvelopeSchema,
  getUserRequest,
  resolveMembershipResponse,
  renderInvoiceResponse,
  rpcSubject,
} from './index.js';

describe('@pos/contracts', () => {
  it('builds namespaced subjects', () => {
    expect(evtSubject('tenancy', 'BusinessCreated')).toBe('pos.evt.tenancy.BusinessCreated');
    expect(rpcSubject('inventory', 'reserveStock')).toBe('pos.rpc.inventory.reserveStock');
    expect(SUBJECTS.tenancy.resolveMembership).toBe('pos.rpc.tenancy.resolveMembership');
  });

  it('round-trips an event envelope', () => {
    const schema = messageEnvelopeSchema.extend({ payload: EVENT_PAYLOADS.BusinessCreated });
    const value = {
      event_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5e',
      occurred_at: '2026-09-01T00:00:00.000Z',
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      producer: 'tenancy',
      schema_version: '1.0.0',
      payload: {
        business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
        name: 'Duka',
        currency: 'TZS',
        locale: 'en',
        owner_user_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d60',
      },
    };
    expect(schema.parse(value)).toEqual(value);
  });

  it('round-trips invitation event payloads', () => {
    expect(SUBJECTS.tenancy.invitationCreated).toBe('pos.evt.tenancy.InvitationCreated');
    expect(SUBJECTS.tenancy.invitationAccepted).toBe('pos.evt.tenancy.InvitationAccepted');

    const created = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      invitation_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d61',
      email: 'staff@example.com',
      role: 'staff' as const,
      accept_url: 'https://app.example/invitations/accept?token=abc',
      expires_at: '2026-09-14T00:00:00.000Z',
    };
    expect(EVENT_PAYLOADS.InvitationCreated.parse(created)).toEqual(created);
    const withCopy = { ...created, business_name: 'Duka', locale: 'sw' };
    expect(EVENT_PAYLOADS.InvitationCreated.parse(withCopy)).toEqual(withCopy);

    const accepted = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      invitation_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d61',
      user_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d62',
    };
    expect(EVENT_PAYLOADS.InvitationAccepted.parse(accepted)).toEqual(accepted);
  });

  it('rejects an internal context missing token_kind', () => {
    expect(internalContextSchema.safeParse({ request_id: 'r' }).success).toBe(false);
  });

  it('accepts a not-found membership response', () => {
    expect(resolveMembershipResponse.parse({ found: false, role: null, status: null })).toEqual({
      found: false,
      role: null,
      status: null,
    });
  });

  it('accepts a getUser request with and without create', () => {
    expect(getUserRequest.parse({ email: 'r@example.com' })).toEqual({ email: 'r@example.com' });
    expect(getUserRequest.parse({ email: 'r@example.com', create: true })).toEqual({
      email: 'r@example.com',
      create: true,
    });
  });

  it('exposes stable error codes', () => {
    expect(ERROR_CODES.operatorDataAccessDenied).toBe('operator_data_access_denied');
  });

  it('builds catalog subjects and round-trips catalog event payloads', () => {
    expect(SUBJECTS.catalog.productUpserted).toBe('pos.evt.catalog.ProductUpserted');
    expect(SUBJECTS.catalog.priceChanged).toBe('pos.evt.catalog.PriceChanged');

    const product = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      product_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d60',
      sku: 'SKU-1',
      name: 'Sukari 1kg',
      unit: 'each',
      is_active: true,
      reorder_threshold: 6,
    };
    expect(EVENT_PAYLOADS.ProductUpserted.parse(product)).toEqual(product);
    // image_url is additive + optional — a payload with it round-trips too.
    const withImage = { ...product, image_url: 'https://cdn.example.com/p.jpg' };
    expect(EVENT_PAYLOADS.ProductUpserted.parse(withImage)).toEqual(withImage);

    const price = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      product_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d60',
      sell_price: 2500,
      winger_price: null,
      currency: 'TZS',
    };
    expect(EVENT_PAYLOADS.PriceChanged.parse(price)).toEqual(price);
  });

  it('builds inventory subjects, event payloads, and reservation RPC pairs', () => {
    expect(SUBJECTS.inventory.stockMovementRecorded).toBe(
      'pos.evt.inventory.StockMovementRecorded',
    );
    expect(SUBJECTS.inventory.commitReservation).toBe('pos.rpc.inventory.commitReservation');

    const moved = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      product_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d60',
      movement_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d61',
      type: 'stock_in' as const,
      quantity_delta: 12,
    };
    expect(EVENT_PAYLOADS.StockMovementRecorded.parse(moved)).toEqual(moved);

    const below = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      product_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d60',
      on_hand: 2,
      threshold: 6,
      opened_at: '2026-09-06T12:00:00.000Z',
      recipients: ['owner@example.com'],
    };
    expect(EVENT_PAYLOADS.StockFellBelowThreshold.parse(below)).toEqual(below);

    const recovered = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      product_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d60',
      on_hand: 7,
      opened_at: '2026-09-06T12:00:00.000Z',
    };
    expect(EVENT_PAYLOADS.StockRecovered.parse(recovered)).toEqual(recovered);
  });

  it('builds sales subjects and round-trips its event payloads', () => {
    expect(SUBJECTS.sales.saleCompleted).toBe('pos.evt.sales.SaleCompleted');
    expect(SUBJECTS.sales.saleVoided).toBe('pos.evt.sales.SaleVoided');

    const lines = [
      {
        product_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d60',
        quantity: 3,
      },
    ];
    const completed = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      sale_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d61',
      reservation_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d62',
      lines,
      total: 3000,
      currency: 'TZS',
    };
    expect(EVENT_PAYLOADS.SaleCompleted.parse(completed)).toEqual(completed);

    const voided = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      sale_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d61',
      lines,
    };
    expect(EVENT_PAYLOADS.SaleVoided.parse(voided)).toEqual(voided);
  });

  it('builds winger subjects and round-trips its event payloads', () => {
    expect(SUBJECTS.winger.wingerAuthorized).toBe('pos.evt.winger.WingerAuthorized');
    expect(SUBJECTS.winger.wingerSuspended).toBe('pos.evt.winger.WingerSuspended');

    const authorized = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      winger_account_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d61',
      user_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d62',
      portal_url: 'https://app.example.com/winger',
      email: 'reseller@example.com',
      locale: 'sw',
    };
    expect(EVENT_PAYLOADS.WingerAuthorized.parse(authorized)).toEqual(authorized);

    const suspended = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      winger_account_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d61',
    };
    expect(EVENT_PAYLOADS.WingerSuspended.parse(suspended)).toEqual(suspended);
  });

  it('round-trips AlertConfigChanged', () => {
    expect(SUBJECTS.inventory.alertConfigChanged).toBe('pos.evt.inventory.AlertConfigChanged');
    const v = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      min_interval_hours: 6,
      recipients: ['owner@example.com'],
    };
    expect(EVENT_PAYLOADS.AlertConfigChanged.parse(v)).toEqual(v);
  });

  it('builds notification subjects and round-trips its event payloads', () => {
    expect(SUBJECTS.notifications.notificationSent).toBe('pos.evt.notifications.NotificationSent');
    const sent = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      notification_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d61',
      type: 'low_stock',
      channel: 'email',
    };
    expect(EVENT_PAYLOADS.NotificationSent.parse(sent)).toEqual(sent);
    const failed = { ...sent, error: 'smtp timeout' };
    expect(EVENT_PAYLOADS.NotificationFailed.parse(failed)).toEqual(failed);
  });

  it('builds invoicing subjects and round-trips customer + invoice payloads', () => {
    expect(SUBJECTS.sales.customerCreated).toBe('pos.evt.sales.CustomerCreated');
    expect(SUBJECTS.sales.invoiceIssued).toBe('pos.evt.sales.InvoiceIssued');
    expect(SUBJECTS.sales.invoicePaymentRecorded).toBe('pos.evt.sales.InvoicePaymentRecorded');
    expect(SUBJECTS.sales.invoiceVoided).toBe('pos.evt.sales.InvoiceVoided');

    const businessId = '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f';
    const customerId = '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d70';
    const invoiceId = '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d71';

    const customer = { business_id: businessId, customer_id: customerId, name: 'Asha Traders' };
    expect(EVENT_PAYLOADS.CustomerCreated.parse(customer)).toEqual(customer);
    const withContact = { ...customer, email: 'asha@example.com', phone: '+255700000000' };
    expect(EVENT_PAYLOADS.CustomerCreated.parse(withContact)).toEqual(withContact);

    const updated = { ...withContact, disabled: false };
    expect(EVENT_PAYLOADS.CustomerUpdated.parse(updated)).toEqual(updated);

    const issued = {
      business_id: businessId,
      invoice_id: invoiceId,
      customer_id: customerId,
      customer_name: 'Asha Traders',
      number: 1,
      currency: 'TZS',
      total_minor: 30000,
      balance_due_minor: 30000,
      issue_date: '2026-09-07T00:00:00.000Z',
      due_date: '2026-09-21T00:00:00.000Z',
      public_token: 'tok_abc123',
      locale: 'sw',
    };
    expect(EVENT_PAYLOADS.InvoiceIssued.parse(issued)).toEqual(issued);
    const fromSale = {
      ...issued,
      sale_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d72',
      customer_email: 'asha@example.com',
    };
    expect(EVENT_PAYLOADS.InvoiceIssued.parse(fromSale)).toEqual(fromSale);
    // v1.4 additive document-snapshot fields round-trip too.
    const withSnapshot = {
      ...issued,
      business_name: 'Duka la Asha',
      subtotal_minor: 30000,
      discount_minor: 0,
      tax_minor: 0,
      lines: [
        {
          description: 'Sukari 1kg',
          quantity: 12,
          unit_price_minor: 2500,
          discount_minor: 0,
          line_total_minor: 30000,
        },
      ],
    };
    expect(EVENT_PAYLOADS.InvoiceIssued.parse(withSnapshot)).toEqual(withSnapshot);

    const paid = {
      business_id: businessId,
      invoice_id: invoiceId,
      payment_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d73',
      amount_minor: 30000,
      method: 'mobile_money' as const,
      balance_due_minor: 0,
      paid_in_full: true,
      locale: 'sw',
    };
    expect(EVENT_PAYLOADS.InvoicePaymentRecorded.parse(paid)).toEqual(paid);

    const voided = { business_id: businessId, invoice_id: invoiceId, reason: 'entered twice' };
    expect(EVENT_PAYLOADS.InvoiceVoided.parse(voided)).toEqual(voided);
  });

  it('builds the media subject + RPC and round-trips InvoiceDocumentReady', () => {
    expect(SUBJECTS.media.invoiceDocumentReady).toBe('pos.evt.media.InvoiceDocumentReady');
    expect(SUBJECTS.media.renderInvoice).toBe('pos.rpc.media.renderInvoice');

    const ready = {
      business_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5f',
      invoice_id: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d71',
      url: 's3://pos-media/invoices/b/i.pdf',
      bytes: 20480,
      sha256: 'a'.repeat(64),
    };
    expect(EVENT_PAYLOADS.InvoiceDocumentReady.parse(ready)).toEqual(ready);

    expect(renderInvoiceResponse.parse({ found: false })).toEqual({ found: false });
    const hit = { found: true as const, url: ready.url, bytes: ready.bytes, sha256: ready.sha256 };
    expect(renderInvoiceResponse.parse(hit)).toEqual(hit);
  });
});
