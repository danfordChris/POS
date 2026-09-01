# /scaffold-service

Create a new NestJS domain service under `services/<svc>/`, matching
`services/identity/` (the reference implementation).

Full skill: [`.agents/skills/skills/backend/scaffold-service.md`](../skills/backend/scaffold-service.md).

## When

A `services/<svc>/` directory does not exist yet and the service has a row in
`docs/design/architecture/service-decomposition.md`.

## Shape to copy from `services/identity/`

- `package.json` (`@pos/<svc>`, same scripts + deps), `nest-cli.json`, `tsconfig*.json`, `vitest.config.ts`, `oxlint.json`
- `prisma/schema.prisma` — domain tables + `OutboxMessage` (`@@map("outbox")`) + `ProcessedEvent` (`@@map("processed_events")`); `url = env("<SVC>_DATABASE_URL")`
- `src/config/{config.module.ts,env.ts}` — zod env via `makeEnvValidator`
- `src/prisma/{prisma.module.ts,prisma.service.ts}` — `@Global`, keep `pingDatabase()`
- `src/platform/{platform.module.ts,outbox-relay.service.ts}` — `NatsModule.forRootAsync({ name: '<svc>' })`, `OutboxRelayService`
- `src/main.ts` + `app.module.ts` — `configureApp`, Swagger, `HealthModule.forRootAsync({ serviceName: '<svc>' })`

## Also

- Add `<svc>` schema+role to `infra/postgres/initdb/20-service-schemas.sql` if missing; `<SVC>_*` to `.env.example`.
- `infra/k8s/base/<svc>.yaml` from `infra/k8s/examples/service.template.yaml` + add to `kustomization.yaml`; add to `infra/docker-compose.yml`.
- Then `/add-service-ci`.

## Verify

`pnpm --filter @pos/<svc> build && pnpm --filter @pos/<svc> test`; `curl localhost:<port>/healthz`; `validate_workflow.py`.
