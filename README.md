# POS Platform

Multi-tenant stock management platform for small retailers. Mobile app, web admin, shared API.

Design and plan live in [`docs/`](docs/README.md). Everything is routed through the
`workflow-contract` workflow.

## Layout

| Path | Stack | Purpose |
|---|---|---|
| `api/` | NestJS + TypeScript | REST API (`/health` stub for now) |
| `web/` | Next.js + TypeScript | web admin console |
| `mobile/` | Flutter | Android / iOS app |
| `infra/` | Docker Compose | local backing services (Postgres, Redis, MinIO, Mailpit) |
| `docs/` | Markdown | product, design, and implementation docs |

`api` and `web` are a pnpm workspace. `mobile` is a standalone Flutter project.

## Prerequisites

- Node.js `>=22` (see `.nvmrc`) and pnpm `10.x` (`corepack enable`)
- Flutter `3.x` with Dart `3.x` — add the SDK's `bin` to your `PATH`
- Docker with the Compose plugin

## Setup

```bash
# 1. environment
cp .env.example .env

# 2. JS dependencies (api + web)
pnpm install

# 3. Flutter dependencies
cd mobile && flutter pub get && cd ..

# 4. local backing services
docker compose -f infra/docker-compose.yml up -d
```

## Run

```bash
# API — http://localhost:3000/health
pnpm --filter api start:dev

# Web — http://localhost:3000 (Next dev server picks the next free port if 3000 is taken)
pnpm --filter web dev

# Mobile
cd mobile && flutter run
```

## Checks

```bash
pnpm format:check        # Prettier (api, web, root config)
pnpm lint                # oxlint (api) + eslint (web)
pnpm test                # vitest (api)
pnpm build               # nest build + next build
cd mobile && flutter analyze && flutter test

# workflow docs
python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py
```

## Conventions

- Commit messages: imperative mood, no author or tool attribution.
- Wrap fallible I/O and external calls in try/catch; surface typed errors.
- No net-new product behavior outside `docs/design/` — see `docs/README.md`.
