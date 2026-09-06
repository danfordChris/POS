import {
  EVENT_PAYLOADS,
  ERROR_CODES,
  SUBJECTS,
  evtSubject,
  internalContextSchema,
  messageEnvelopeSchema,
  resolveMembershipResponse,
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
});
