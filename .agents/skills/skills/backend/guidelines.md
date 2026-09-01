# Backend Guidelines

Project-wide conventions for `services/*` and the shared `packages/*`. Read once
per session before backend work; individual task skills assume these hold.

## 0. Placeholder conventions

Substitute before using any snippet:

| Token | Replace with | Example |
|---|---|---|
| `<svc>` | lowercase service name | `services/<svc>/` → `services/catalog/` |
| `<Svc>` | PascalCase service name | `<Svc>Rpc` → `CatalogRpc` |
| `<SVC>` | SCREAMING_SNAKE service name | `<SVC>_DATABASE_URL` → `CATALOG_DATABASE_URL` |
| `<Context>` | event/RPC context segment | `pos.evt.<context>.<Event>` → `pos.evt.catalog.ProductUpserted` |
| `<Model>` | a Prisma model / table | `<Model>` → `Product` (`@@map("product")`) |
| `<Event>` | PascalCase past-tense event | `ProductUpserted`, `SaleCompleted` |

Framework names shown verbatim (`OutboxWriter`, `runIdempotent`,
`runInTenantContext`, `MESSAGE_BUS`, `SUBJECTS`, `configureApp`) are from
`@pos/nest-common` / `@pos/contracts` — keep as-is.

## 1. Build & commands

`api` + `web` + `packages/*` + `services/*` are one pnpm workspace
(`pnpm-workspace.yaml`). Node version in `.nvmrc`.

```bash
pnpm install                          # workspace install
pnpm format                           # prettier
pnpm lint                             # oxlint, all packages
pnpm test                             # vitest, all packages
pnpm --filter @pos/<svc> test         # one service
pnpm --filter @pos/<svc> build        # nest build
pnpm --filter @pos/<svc> migrate:dev  # prisma migrate dev (per-service schema)
```

Local backing services (NATS/JetStream, Postgres, MinIO, Mailpit):

```bash
docker compose -f infra/docker-compose.yml up -d
```

Per-service env vars live in the repo-root `.env` (see `.env.example`); each
service's `config.module.ts` loads `../../.env` then a local `.env`.

## 2. Testing rules

- `vitest`; specs are `src/**/*.spec.ts` (unit) and `test/**/*.e2e-spec.ts` (integration).
- Use `@pos/testing`: `InMemoryBus` (NATS double), in-memory outbox/idempotency stores, fixture builders. Do not hit real NATS in unit tests.
- Required coverage for repeatable tasks:
  - **Event**: zod round-trip test in `packages/contracts`.
  - **Consumer**: same `event_id` delivered twice → exactly one state change.
  - **RPC**: request + response schema test; `reserveStock`/`releaseReservation`-class handlers proven idempotent.
  - **Endpoint**: contract test for the happy path **and** every documented error code from `api-contract.md`.
  - **RLS**: a non-member / cross-tenant request returns 403 and leaks no rows.

## 3. Code style

- ESM: `"type": "module"`; import sibling files with the `.js` extension (`./foo.js`), `moduleResolution: nodenext`.
- Wrap fallible I/O and external calls in try/catch; return the typed error envelope (`@pos/nest-common` `AllExceptionsFilter` shape `{ error: { code, message, details }, requestId }`), never a raw stack trace.
- Validation only at boundaries: DTOs (`class-validator`) for HTTP, `zod` `.parse()` for bus payloads and env. Trust internal calls past that.
- Prisma models: `@id @default(dbgenerated("uuidv7()")) @db.Uuid`, `@db.Timestamptz(6)`, snake_case `@map`/`@@map`, `created_at` / `disabled_at` naming.
- No cross-service imports of another service's Prisma client, DTOs, or domain types. Shared shapes go through `@pos/contracts`.

## 4. Skill routing map

| Work | Skill |
|---|---|
| new `services/<svc>/` | [scaffold-service](scaffold-service.md) |
| table + migration + RLS | [add-prisma-model](add-prisma-model.md) |
| emit a domain event | [add-event](add-event.md) |
| react to a domain event | [add-consumer](add-consumer.md) |
| request/reply subject | [add-rpc](add-rpc.md) |
| public REST route | [add-endpoint](add-endpoint.md) |
| CI job for a service | [add-service-ci](add-service-ci.md) |
| any doc / task / proposal | [workflow-contract](../../workflow-contract/SKILL.md) (first) |

## 5. Sensitive areas (extra review + tests)

- Auth, tokens, refresh-token rotation (`services/identity`).
- Internal-context signing/verification and RLS (`@pos/nest-common` tenant/*, gateway).
- Money and quantity math: `sales` totals, `inventory` ledger invariant `quantity == sum(quantity_delta)`.
- The sale saga (`reserveStock` → `SaleCompleted` → `commitReservation`; failure → `releaseReservation`). No partial writes.
- Winger product projection — fixed whitelist; a schema test must assert no extra fields.
- Operator/control-plane routes must never read tenant data (`operator_data_access_denied`).

## 6. Definition of done

- [ ] Design doc covers the behavior (or a `docs/changes/proposed/` entry exists).
- [ ] Contracts changed only in `@pos/contracts`, with round-trip tests.
- [ ] `pnpm format && pnpm lint && pnpm test` clean.
- [ ] `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` clean if any doc changed.
- [ ] Task doc `Verification` section has the command + pasted evidence.
