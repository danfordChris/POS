import { InMemoryBus, InMemoryOutboxStore, makeFakeTx } from '@pos/testing';
import { OutboxRelay, OutboxWriter } from './outbox.js';

describe('OutboxWriter (caller transaction)', () => {
  const writer = new OutboxWriter();

  it('stages the row; a rolled-back transaction persists nothing', async () => {
    const store = new InMemoryOutboxStore();
    const { tx, staged } = makeFakeTx();

    try {
      await writer.write(tx, { subject: 'pos.evt.tenancy.BusinessCreated', payload: { id: 'b1' } });
      throw new Error('domain write failed');
    } catch {
      /* rolled back: nothing committed to the store */
    }

    expect(staged).toHaveLength(1);
    expect(staged[0]).toMatchObject({
      subject: 'pos.evt.tenancy.BusinessCreated',
      payload: { id: 'b1' },
      headers: {},
    });
    expect(store.rows).toHaveLength(0);
  });

  it('a committed transaction makes the row visible to the relay, published exactly once', async () => {
    const store = new InMemoryOutboxStore();
    const bus = new InMemoryBus();
    const { tx, staged } = makeFakeTx();

    await writer.write(tx, { subject: 'pos.evt.tenancy.BusinessCreated', payload: { id: 'b2' } });
    // commit: flush staged rows to the store
    staged.forEach((s) => store.append(s));

    const relay = new OutboxRelay(store, bus);
    expect(await relay.tick()).toBe(1);
    expect(await relay.tick()).toBe(0); // already sent

    expect(bus.publishes).toHaveLength(1);
    expect(bus.publishes[0]).toMatchObject({
      subject: 'pos.evt.tenancy.BusinessCreated',
      data: { id: 'b2' },
    });
  });
});

describe('OutboxRelay crash recovery', () => {
  it('re-publishes a row whose markSent did not land (at-least-once)', async () => {
    const store = new InMemoryOutboxStore();
    const bus = new InMemoryBus();
    store.append({ subject: 's', payload: { n: 1 } });

    // First tick: publish succeeds but the process "crashes" before markSent.
    const original = store.markSent.bind(store);
    store.markSent = async () => {
      throw new Error('crash before commit');
    };
    await expect(relayTickSwallow(new OutboxRelay(store, bus))).resolves.toBeUndefined();
    expect(bus.publishes).toHaveLength(1);
    expect(store.rows[0].sentAt).toBeNull();

    // Restart: markSent works; the row is re-published, then settled.
    store.markSent = original;
    const published = await new OutboxRelay(store, bus).tick();
    expect(published).toBe(1);
    expect(bus.publishes).toHaveLength(2);
    expect(store.rows[0].sentAt).not.toBeNull();
  });

  it('records the error and keeps the row unsent when publish fails', async () => {
    const store = new InMemoryOutboxStore();
    store.append({ subject: 's', payload: {} });
    const failingBus = new InMemoryBus();
    failingBus.publish = async () => {
      throw new Error('nats down');
    };

    const relay = new OutboxRelay(store, failingBus);
    expect(await relay.tick()).toBe(0);
    expect(store.rows[0].sentAt).toBeNull();
    expect(store.rows[0].attempts).toBe(1);
    expect(store.rows[0].lastError).toBe('nats down');
  });
});

async function relayTickSwallow(relay: OutboxRelay): Promise<void> {
  try {
    await relay.tick();
  } catch {
    /* the crashing markSent surfaces here */
  }
}
