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
});
