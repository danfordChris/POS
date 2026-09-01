# Add a Prisma Model — table + migration + tenant RLS

Add a persisted table owned by exactly one service.

## Arguments

`$ARGUMENTS` — service + model + whether it is tenant-scoped, e.g.
`inventory: stock_movement, tenant-scoped (has business_id)`

## Rules

- The model goes in **one** service's `services/<svc>/prisma/schema.prisma`. No other service references it.
- Cross-service links are plain id columns (`business_id`, `product_id`, `user_id`) — **no** `@relation` across services, no cross-schema FK.
- Tenant-scoped table = has `businessId String @map("business_id") @db.Uuid` → it must get RLS.
- Denormalized caches rebuilt from events are fine (e.g. `sales` caches product name+price); document the owning event.

## Steps

### 1. Model

```prisma
model <Model> {
  id         String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  businessId  String   @map("business_id") @db.Uuid          // tenant-scoped only
  // ... domain columns; snake_case @map
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([businessId])                                       // tenant-scoped only
  @@map("<model_snake>")
}
```

Match `data-model.md`. Money = integer minor units + a sibling `currency`.
Ledger tables are append-only — no `updatedAt`, enforce deltas in the handler.

### 2. Migration

```bash
pnpm --filter @pos/<svc> migrate:dev --name add_<model_snake>
```

Applies to the service's own schema only (`search_path` pinned by the `<svc>_app` role).

### 3. RLS (tenant-scoped tables)

Add to the migration SQL (pattern from `@pos/nest-common` `tenant/rls.ts` and the
tenancy service's `enable_tenant_rls`):

```sql
ALTER TABLE "<model_snake>" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "<model_snake>" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "<model_snake>"
  USING (business_id = current_setting('app.current_business_id')::uuid);
```

### 4. Scope every query

Handlers touching this table run inside:

```ts
await runInTenantContext(prisma, businessId, async (tx) => {
  // tx.* statements are RLS-scoped to businessId
});
```

`business_id` comes from the verified internal context, never from the request body.

### 5. Tests

- On-hand / invariant tests where the table is a ledger (`quantity == sum(quantity_delta)`).
- A cross-tenant test: a query with a different `business_id` in context returns zero rows.

## Verification

```bash
pnpm --filter @pos/<svc> migrate:dev
pnpm --filter @pos/<svc> test
psql "$<SVC>_DATABASE_URL" -c "\d+ <model_snake>"     # confirm RLS enabled + forced
```

## Checklist

- [ ] Model only in `services/<svc>/prisma/schema.prisma`; no cross-service relation
- [ ] `uuidv7()` id, `Timestamptz(6)`, snake_case `@map`/`@@map`
- [ ] Migration named `add_<model_snake>` applied to the `<svc>` schema
- [ ] Tenant-scoped: RLS `ENABLE` + `FORCE` + `tenant_isolation` policy in the migration
- [ ] All access wrapped in `runInTenantContext`
- [ ] Cross-tenant test returns no rows
- [ ] `data-model.md` updated if the shape is new (design layer)
