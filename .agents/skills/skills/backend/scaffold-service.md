# Scaffold Service — Create a new `services/<svc>/` module

Stand up a new NestJS domain service in the monorepo, matching
`services/identity/` (the reference implementation).

## Arguments

`$ARGUMENTS` — service name + one-line ownership, e.g.
`catalog: owns category + product; emits ProductUpserted / PriceChanged / CategoryUpserted / ProductDeactivated; consumes BusinessCreated`

Confirm the row for `<svc>` in `docs/design/architecture/service-decomposition.md`
before starting. Do not add ownership not in that table.

## Prerequisites

- `<SVC>_DATABASE_URL` already present in `.env.example` / `.env` (schema + role per service).
- Postgres role + schema created by `infra/postgres/initdb/20-service-schemas.sql` (add a stanza if missing).
- `docker compose -f infra/docker-compose.yml up -d` running.

## Steps

### 1. Copy the skeleton

```
services/<svc>/
  package.json          # name "@pos/<svc>"; copy scripts + deps verbatim from services/identity/package.json
  nest-cli.json         # identical
  tsconfig.json  tsconfig.build.json  vitest.config.ts  oxlint.json  .prettierrc   # identical
  prisma/schema.prisma  # see step 2
  src/
    main.ts             # copy identity/src/main.ts; swap "identity" → "<svc>", IDENTITY_PORT → <SVC>_PORT
    app.module.ts       # ConfigModule, PrismaModule, PlatformModule, HealthModule.forRootAsync (serviceName "<svc>")
    config/config.module.ts   # identical
    config/env.ts       # see step 3
    prisma/prisma.module.ts   # identical (@Global)
    prisma/prisma.service.ts  # identical (keep pingDatabase)
    platform/platform.module.ts     # NatsModule.forRootAsync, name: '<svc>'
    platform/outbox-relay.service.ts # identical; import ../prisma/prisma.service.js
    types/express.d.ts  # identical
```

`web` + `api` + `packages/*` + `services/*` are already globbed by
`pnpm-workspace.yaml` — no edit needed. Run `pnpm install` to link.

### 2. `prisma/schema.prisma`

- `datasource db { url = env("<SVC>_DATABASE_URL") }`.
- Domain models from `docs/design/data/data-model.md` for this service only.
- Always include the two platform tables (copy from `services/identity/prisma/schema.prisma`):
  - `OutboxMessage` → `@@map("outbox")`
  - `ProcessedEvent` → `@@map("processed_events")`
- Tenant tables get RLS — see [add-prisma-model](add-prisma-model.md). (`identity` has none.)

```bash
pnpm --filter @pos/<svc> migrate:dev --name init
```

### 3. `src/config/env.ts`

```ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  <SVC>_PORT: z.coerce.number().int().positive().default(<port>),   // identity 3001, next free port
  <SVC>_DATABASE_URL: z.string().min(1, '<SVC>_DATABASE_URL is required'),
  NATS_URL: z.string().min(1).default('nats://localhost:4222'),
  INTERNAL_CONTEXT_SECRET: z.string().min(16),   // any service that verifies the gateway's forwarded context
});
export type Env = z.infer<typeof envSchema>;
```

### 4. Domain module

Create `src/<domain>/<domain>.module.ts` with controllers, DTOs, service, and —
if this service replies to RPC or relays an outbox — list `OutboxRelayService`
and `<Svc>Rpc` in `providers`. See how `services/identity/src/auth/auth.module.ts`
wires `IdentityRpc` + `OutboxRelayService`.

### 5. Health

`HealthModule.forRootAsync` with `serviceName: '<svc>'` and a `db` check calling
`prisma.pingDatabase()`. Add a NATS check if the service consumes events. This
gives `/healthz` + `/readyz` for free.

### 6. Infra

- `infra/k8s/base/<svc>.yaml` — copy `infra/k8s/examples/service.template.yaml`, replace `SVC`. `notifications` is a worker: Deployment + PDB only.
- Add `<svc>.yaml` to `infra/k8s/base/kustomization.yaml`.
- Add the service to `infra/docker-compose.yml`.
- Add `<SVC>_DATABASE_URL` to `infra/k8s/base/secret.example.yaml`.

### 7. CI

→ [add-service-ci](add-service-ci.md).

## Verification

```bash
pnpm --filter @pos/<svc> build
pnpm --filter @pos/<svc> test
pnpm --filter @pos/<svc> start      # then: curl localhost:<port>/healthz && curl localhost:<port>/readyz
python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py
```

## Checklist

- [ ] `services/<svc>/` files present, `pnpm install` links `@pos/<svc>`
- [ ] `prisma/schema.prisma` has domain tables + `outbox` + `processed_events`; `migrate:dev` applied to the `<svc>` schema
- [ ] `env.ts` zod schema; `<SVC>_*` vars in `.env.example`
- [ ] `PlatformModule` connects NATS as `name: '<svc>'`
- [ ] `OutboxRelayService` registered if the service emits events
- [ ] `/healthz` + `/readyz` respond
- [ ] k8s manifest + kustomization + compose + secret example updated
- [ ] CI job added ([add-service-ci](add-service-ci.md))
- [ ] `service-decomposition.md` row matches what was built; no extra ownership
