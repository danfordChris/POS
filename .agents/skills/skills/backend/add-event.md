# Add a Domain Event (producer side)

Publish a fact that already happened, for other contexts to consume. Async-first:
this is the default way state crosses a service boundary.

## Arguments

`$ARGUMENTS` — producer + event + payload, e.g.
`catalog: ProductUpserted { business_id, product_id, sku, name, unit, is_active }`

First check `docs/design/interfaces/events-catalog.md`. If the event is not
listed, add the row there (design layer) or open `docs/changes/proposed/` — do
not ship an undocumented event.

## Rules

- Subject: `pos.evt.<context>.<Event>`. Constant in `@pos/contracts/src/subjects.ts` under `SUBJECTS.<context>.<event>`.
- Name is **past tense** (`ProductUpserted`, not `UpsertProduct`).
- Envelope carries `event_id` (uuid), `occurred_at` (ISO), `business_id` (null only for `identity`), `producer`, `schema_version`. Use `makeEnvelope` from `@pos/contracts`.
- Emit **only via the transactional outbox** — domain write + `outbox` row in the same Prisma transaction. Never `bus.publish` directly from a handler.
- No secret, password hash, or full token in a payload.
- Additive field → bump `schema_version` minor. Breaking change → new subject `…V2` + deprecation window.

## Steps

### 1. Schema + subject in `@pos/contracts`

`packages/contracts/src/events.ts`:

```ts
export const productUpserted = z.object({
  business_id: z.string().uuid(),
  product_id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  unit: z.string(),
  is_active: z.boolean(),
});
export type ProductUpserted = z.infer<typeof productUpserted>;
```

`packages/contracts/src/subjects.ts`:

```ts
export const SUBJECTS = {
  // ...
  catalog: { productUpserted: 'pos.evt.catalog.ProductUpserted' },
} as const;
```

Export both from `packages/contracts/src/index.ts` if not covered by `export *`.

### 2. Round-trip test

`packages/contracts/src/contracts.spec.ts` — parse a sample payload, assert it
survives `schema.parse(JSON.parse(JSON.stringify(sample)))`.

### 3. Emit from the producer

```ts
await this.prisma.$transaction(async (tx) => {
  const product = await tx.product.upsert({ /* ... */ });
  await new OutboxWriter(new PrismaOutboxStore(tx)).write(
    SUBJECTS.catalog.productUpserted,
    makeEnvelope(productUpserted.parse({ /* fields */ }), { producer: 'catalog', business_id }),
  );
});
```

`OutboxRelayService` (registered in the service's domain module) publishes to
JetStream and marks the row sent. Confirm the service was scaffolded with it.

### 4. Stream

Ensure the context's stream in `events-catalog.md` exists in the NATS bootstrap
(`packages/nest-common` messaging / infra). Streams: `IDENTITY`, `TENANCY`,
`CATALOG`, `INVENTORY`, `SALES`, `WINGER`, `NOTIFICATIONS`.

## Verification

```bash
pnpm --filter @pos/contracts test
pnpm --filter @pos/<svc> test
# integration: trigger the write, assert one `outbox` row, run the relay tick, assert published
```

## Checklist

- [ ] Row exists in `events-catalog.md` (producer, payload, consumers)
- [ ] zod schema + `SUBJECTS.<context>.<event>` constant in `@pos/contracts`, exported
- [ ] Round-trip test in `packages/contracts`
- [ ] Emitted via `OutboxWriter` inside the domain transaction — no direct publish
- [ ] `makeEnvelope` used; `business_id` set (or explicitly null for identity)
- [ ] No secret/hash/token in the payload
- [ ] Each consumer handled → [add-consumer](add-consumer.md)
