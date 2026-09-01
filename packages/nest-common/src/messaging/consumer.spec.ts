import { InMemoryBus } from '@pos/testing';
import { subscribeWithDlq } from './consumer.js';

describe('subscribeWithDlq', () => {
  it('acks a message the handler processes on the first try', async () => {
    const bus = new InMemoryBus();
    const seen: unknown[] = [];
    await subscribeWithDlq(bus, 'pos.evt.x.Y', async (m) => void seen.push(m.data), {
      durable: 'c',
      maxDeliver: 3,
      dlqSubject: 'pos.dlq.x.Y',
    });

    await bus.publish('pos.evt.x.Y', { ok: true }, { msgId: 'm1' });
    await bus.flush();

    expect(seen).toEqual([{ ok: true }]);
    expect(bus.publishes.filter((p) => p.subject === 'pos.dlq.x.Y')).toHaveLength(0);
  });

  it('retries then dead-letters a permanently failing message', async () => {
    const bus = new InMemoryBus();
    let attempts = 0;
    await subscribeWithDlq(
      bus,
      'pos.evt.x.Y',
      async () => {
        attempts += 1;
        throw new Error('always fails');
      },
      { durable: 'c', maxDeliver: 3, dlqSubject: 'pos.dlq.x.Y' },
    );

    await bus.publish('pos.evt.x.Y', { n: 1 }, { msgId: 'poison' });
    await bus.flush();

    expect(attempts).toBe(3);
    const dlq = bus.publishes.filter((p) => p.subject === 'pos.dlq.x.Y');
    expect(dlq).toHaveLength(1);
    expect(dlq[0].opts?.headers).toMatchObject({
      'x-original-subject': 'pos.evt.x.Y',
      'x-error': 'always fails',
      'x-delivery-count': '3',
    });
  });

  it('recovers if the handler succeeds on a later delivery', async () => {
    const bus = new InMemoryBus();
    let attempts = 0;
    const done: unknown[] = [];
    await subscribeWithDlq(
      bus,
      'pos.evt.x.Y',
      async (m) => {
        attempts += 1;
        if (attempts < 2) throw new Error('transient');
        done.push(m.data);
      },
      { durable: 'c', maxDeliver: 5, dlqSubject: 'pos.dlq.x.Y' },
    );

    await bus.publish('pos.evt.x.Y', { v: 42 }, { msgId: 'retryable' });
    await bus.flush();

    expect(attempts).toBe(2);
    expect(done).toEqual([{ v: 42 }]);
    expect(bus.publishes.filter((p) => p.subject === 'pos.dlq.x.Y')).toHaveLength(0);
  });
});
