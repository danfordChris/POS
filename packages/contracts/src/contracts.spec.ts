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
});
