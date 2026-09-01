import { RpcTimeoutError } from '@pos/contracts';
import { InMemoryBus, subjectMatches } from './in-memory-bus.js';

describe('subjectMatches', () => {
  it('matches exact, * token, and > tail', () => {
    expect(
      subjectMatches('pos.evt.tenancy.BusinessCreated', 'pos.evt.tenancy.BusinessCreated'),
    ).toBe(true);
    expect(subjectMatches('pos.evt.*.BusinessCreated', 'pos.evt.tenancy.BusinessCreated')).toBe(
      true,
    );
    expect(subjectMatches('pos.evt.tenancy.>', 'pos.evt.tenancy.BusinessCreated')).toBe(true);
    expect(subjectMatches('pos.evt.tenancy.*', 'pos.evt.tenancy.a.b')).toBe(false);
    expect(subjectMatches('pos.rpc.>', 'pos.evt.tenancy.X')).toBe(false);
  });
});

describe('InMemoryBus', () => {
  it('delivers a published message to a matching subscriber', async () => {
    const bus = new InMemoryBus();
    const got: unknown[] = [];
    await bus.subscribe('pos.evt.tenancy.>', async (m) => void got.push(m.data), { durable: 'c1' });

    await bus.publish('pos.evt.tenancy.BusinessCreated', { id: 1 });
    await bus.flush();

    expect(got).toEqual([{ id: 1 }]);
  });

  it('round-trips a request/reply', async () => {
    const bus = new InMemoryBus();
    await bus.reply('pos.rpc.tenancy.resolveMembership', async (data) => ({
      echo: data,
      found: true,
    }));

    const res = await bus.request('pos.rpc.tenancy.resolveMembership', { user: 'u1' }, 500);
    expect(res).toEqual({ echo: { user: 'u1' }, found: true });
  });

  it('times out a request with no responder', async () => {
    const bus = new InMemoryBus();
    await expect(bus.request('pos.rpc.nope.method', {}, 30)).rejects.toBeInstanceOf(
      RpcTimeoutError,
    );
  });

  it('redelivers on nak up to maxDeliver', async () => {
    const bus = new InMemoryBus();
    const attempts: number[] = [];
    await bus.subscribe(
      'pos.evt.x.Y',
      async (m) => {
        attempts.push(m.deliveryCount);
        await m.nak();
      },
      { durable: 'c', maxDeliver: 3 },
    );

    await bus.publish('pos.evt.x.Y', {}, { msgId: 'fixed' });
    await bus.flush();

    expect(attempts).toEqual([1, 2, 3]);
  });
});
