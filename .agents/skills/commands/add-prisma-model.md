# /add-prisma-model

Add a persisted table owned by exactly one service, with migration and tenant RLS.

Full skill: [`.agents/skills/skills/backend/add-prisma-model.md`](../skills/backend/add-prisma-model.md).

## When

New data persisted by one service. Match `docs/design/data/data-model.md`.

## Steps

1. **Model** in `services/<svc>/prisma/schema.prisma` only: `id String @id @default(dbgenerated("uuidv7()")) @db.Uuid`, `@db.Timestamptz(6)`, snake_case `@map`/`@@map`. Cross-service links are plain id columns — no `@relation` across services.
2. **Migration**: `pnpm --filter @pos/<svc> migrate:dev --name add_<model_snake>` (applies to the `<svc>` schema only).
3. **RLS** (tenant-scoped tables — those with `business_id`): add to the migration SQL —
   ```sql
   ALTER TABLE "<t>" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "<t>" FORCE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON "<t>"
     USING (business_id = current_setting('app.current_business_id')::uuid);
   ```
4. **Scope access**: wrap all queries in `runInTenantContext(prisma, businessId, tx => ...)`. `business_id` comes from the internal context, never the request body.

## Tests

Ledger invariant where applicable (`quantity == sum(quantity_delta)`);
cross-tenant query returns zero rows.

## Verify

`pnpm --filter @pos/<svc> migrate:dev && pnpm --filter @pos/<svc> test`;
`psql "$<SVC>_DATABASE_URL" -c "\d+ <t>"` shows RLS enabled + forced.
