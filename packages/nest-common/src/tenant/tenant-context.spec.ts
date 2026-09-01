import { TenantContext, TenantContextError } from './tenant-context.js';

function fakeClient() {
  const calls: string[] = [];
  return {
    calls,
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const tx = {
        $executeRaw: async (q: TemplateStringsArray, ...v: unknown[]) => {
          calls.push(q.join('?') + ' :: ' + JSON.stringify(v));
          return 0;
        },
      };
      return fn(tx);
    },
  };
}

describe('TenantContext', () => {
  it('binds the business id and sets the GUC inside the transaction', async () => {
    const tc = new TenantContext();
    const client = fakeClient();

    const seen = await tc.run(client, '018f-biz', async () => tc.currentBusinessId());

    expect(seen).toBe('018f-biz');
    expect(client.calls[0]).toContain("set_config('app.business_id'");
    expect(client.calls[0]).toContain('018f-biz');
  });

  it('has no context outside run()', () => {
    const tc = new TenantContext();
    expect(tc.currentBusinessId()).toBeUndefined();
    expect(() => tc.assert()).toThrow(TenantContextError);
  });

  it('wraps a GUC failure with a clear message', async () => {
    const tc = new TenantContext();
    const client = {
      $transaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
        fn({
          $executeRaw: async () => {
            throw new Error('boom');
          },
        }),
    };
    await expect(tc.run(client, 'x', async () => 1)).rejects.toThrow(
      /Failed to bind tenant context: boom/,
    );
  });
});
