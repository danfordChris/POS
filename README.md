# POS Platform

Multi-tenant stock management platform for small retailers. Flutter app, Next.js web admin,
NestJS microservices behind a Kong edge gateway.

Design and plan live in [`docs/`](docs/README.md). Every change is routed through the
`workflow-contract` workflow.

## Architecture

Kong (edge, DB-less) → domain microservices over NATS + a shared PostgreSQL (one schema and
non-superuser role per service). Kong authenticates the JWT and injects an HMAC-signed
internal context that each service verifies; no service is reachable un-fronted. See
[`docs/design/architecture/service-decomposition.md`](docs/design/architecture/service-decomposition.md)
and [decision 0002](docs/design/decisions/0002-microservices.md).

Shipped services: `identity` (accounts, auth, tokens), `tenancy` (businesses, memberships,
RLS). Planned: `catalog`, `inventory`, `sales`, `winger`, `notifications`.

## Layout

| Path | Stack | Purpose |
|---|---|---|
| `services/*` | NestJS + TypeScript | domain microservices (`identity`, `tenancy`, …) |
| `packages/*` | TypeScript | `@pos/contracts` (events/RPC/errors), `@pos/nest-common` (shared Nest building blocks), `@pos/testing` (in-memory bus + stores) |
| `web/` | Next.js + TypeScript | web admin console |
| `mobile/` | Flutter | Android / iOS app |
| `infra/` | Docker Compose, Kong config, k8s kustomize | local stack + edge + deploy manifests |
| `docs/` | Markdown | product, design, and implementation docs |

`services/*`, `packages/*`, and `web` form one pnpm workspace. `mobile` is a standalone
Flutter project.

## Prerequisites

- Node.js `>=22` (see `.nvmrc`) and pnpm `10.x` (`corepack enable`)
- Flutter `3.x` with Dart `3.x` — add the SDK's `bin` to your `PATH`
- Docker with the Compose plugin

## Setup

```bash
# 1. environment
cp .env.example .env

# 2. JS dependencies (services + packages + web)
pnpm install

# 3. Flutter dependencies
cd mobile && flutter pub get && cd ..

# 4. full local stack — Postgres, NATS, Kong, identity, tenancy, plus redis/minio/mailpit
docker compose -f infra/docker-compose.yml up -d
```

The compose stack builds and runs the services; Kong listens on `:8000` (proxy) and `:8001`
(admin). Hit the API through Kong, e.g. `POST http://localhost:8000/v1/auth/register`.

## Run a service directly

```bash
# from the repo root, against the compose Postgres/NATS
pnpm --filter @pos/identity start:dev   # http://localhost:3001/healthz
pnpm --filter @pos/tenancy start:dev    # http://localhost:3002/healthz

# web
pnpm --filter web dev

# mobile
cd mobile && flutter run
```

## Checks

```bash
pnpm format:check       # Prettier
pnpm lint               # oxlint (services/packages) + eslint (web)
pnpm -r test            # vitest across the workspace
pnpm -r build           # nest build + next build
cd mobile && flutter analyze && flutter test

# edge + deploy manifests
kong config parse infra/kong/kong.yml
kubectl kustomize infra/k8s/base

# workflow docs
python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py

# everything CI runs, locally
scripts/ci-local.sh
```

## CI / branch protection

`.github/workflows/ci.yml` runs a per-service matrix (lint, test against ephemeral
Postgres + NATS, build, `docker build`), a `@pos/contracts` backward-compatibility check,
the Kong config parse + `kubectl kustomize` render, the workflow-doc validator, and the web
build. `main` should require all jobs to pass before merge.

## Conventions

- Commit messages: imperative mood, no author or tool attribution.
- Wrap fallible I/O and external calls in try/catch; surface typed errors.
- Every error body is `{ error: { code, message, devMessage, details }, requestId }` —
  `message` for end users, `devMessage` for developers.
- Services never `import from '@prisma/client'` — each Prisma package generates into
  `generated/prisma/` and is imported via the `#prisma` package subpath.
- No net-new product behavior outside `docs/design/` — see [`docs/README.md`](docs/README.md).
