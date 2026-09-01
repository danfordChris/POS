import { InMemoryIdempotencyStore } from '@pos/testing';
import { runIdempotent } from './idempotency.js';

describe('runIdempotent', () => {
  it('runs the handler once per event id', async () => {
    const store = new InMemoryIdempotencyStore();
    let runs = 0;
    const fn = async () => {
      runs += 1;
      return runs;
    };

    const first = await runIdempotent(store, 'evt-1', 'pos.evt.x.Y', fn);
    const second = await runIdempotent(store, 'evt-1', 'pos.evt.x.Y', fn);

    expect(first).toEqual({ skipped: false, result: 1 });
    expect(second).toEqual({ skipped: true });
    expect(runs).toBe(1);
    expect(store.size).toBe(1);
  });

  it('does not mark the event when the handler throws', async () => {
    const store = new InMemoryIdempotencyStore();
    await expect(
      runIdempotent(store, 'evt-2', 's', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await store.wasProcessed('evt-2')).toBe(false);
  });
});
