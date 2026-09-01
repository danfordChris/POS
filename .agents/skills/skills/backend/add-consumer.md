# Add an Idempotent Event Consumer

Make a service react to another service's domain event. Every consumer here is
durable, idempotent on `event_id`, and dead-letters poison messages.

## Arguments

`$ARGUMENTS` — consumer + event + effect, e.g.
`inventory consumes catalog.ProductUpserted → seed stock_item row`

Confirm the (event → consumer) pair is listed in
`docs/design/interfaces/events-catalog.md`.

## Rules

- One **durable** consumer per `(service, event)`. Explicit ack.
- Handler is **idempotent**: record `event_id` in `processed_events`; a duplicate delivery is a no-op. Use `runIdempotent` from `@pos/nest-common`.
- `max-deliver` with dead-letter subject `pos.dlq.<context>.<Event>` — no infinite retry. Use `subscribeWithDlq` from `@pos/nest-common/messaging/consumer`.
- Tenant-scoped side effects run in `runInTenantContext(business_id)` using the `business_id` from the event envelope.
- The consumer treats any copied data as a **read-only cache** rebuilt from events; the emitting service stays the owner.

## Steps

### 1. Handler class

```ts
@Injectable()
export class CatalogEventsConsumer implements OnApplicationBootstrap {
  constructor(
    @Inject(MESSAGE_BUS) private readonly bus: MessageBus,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await subscribeWithDlq(this.bus, {
      subject: SUBJECTS.catalog.productUpserted,
      durable: 'inventory-product-upserted',
      maxDeliver: 5,
    }, async (raw, meta) => {
      const evt = productUpserted.parse(raw.data);
      await runIdempotent(new PrismaIdempotencyStore(this.prisma), meta.eventId, async () => {
        await runInTenantContext(this.prisma, evt.business_id, async (tx) => {
          await tx.stockItem.upsert({
            where: { businessId_productId: { businessId: evt.business_id, productId: evt.product_id } },
            create: { businessId: evt.business_id, productId: evt.product_id, quantity: 0 },
            update: {},
          });
        });
      });
    });
  }
}
```

### 2. Register

Add the consumer to the domain module `providers`. It needs `PrismaModule` and
`PlatformModule` (for `MESSAGE_BUS`) in scope — both are in `app.module.ts`.

### 3. Idempotency test (required)

Deliver the same envelope (same `event_id`) twice → assert exactly one state
change (one row, unchanged on the second delivery). Use `InMemoryBus` +
in-memory idempotency store from `@pos/testing`.

### 4. DLQ test

A payload that throws in the handler is redelivered up to `maxDeliver`, then
lands on `pos.dlq.<context>.<Event>` — assert it does not loop forever.

## Verification

```bash
pnpm --filter @pos/<svc> test
```

## Checklist

- [ ] (event → this consumer) row present in `events-catalog.md`
- [ ] Durable name unique: `<svc>-<event-kebab>`
- [ ] `runIdempotent` on `meta.eventId` wraps all side effects
- [ ] `subscribeWithDlq` with finite `maxDeliver` and the `pos.dlq.*` subject
- [ ] Tenant side effects inside `runInTenantContext(evt.business_id)`
- [ ] Duplicate-delivery test → one state change
- [ ] Poison-message test → dead-letters, no infinite retry
- [ ] Copied fields treated as cache; not re-emitted as if owned
