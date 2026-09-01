# T-0009 Local Docker-Compose Stack

## Status

- `blocked`
- Last updated: 2026-09-01

> **Superseded.** Superseded by Phase 01 T-0111 (NATS + per-service databases in compose).

## Linked Phase

- Phase 00 — Foundations

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/system-overview.md`, `docs/design/integrations/README.md`
- Constraints: full stack must run with zero external SaaS accounts; every service has a healthcheck; secrets only via `.env` (git-ignored) with `.env.example` committed.
- Do not touch: production deploy config (out of scope for Phase 00).

## Objective

`docker compose up` brings up Postgres, Redis, MinIO, a mail-capture service, and the API + web containers wired together for local development.

## Scope Boundary

**In scope:**
- `infra/docker-compose.yml`: `postgres`, `redis`, `minio`, `mailpit`, `api`, `web`.
- Healthchecks and `depends_on: condition: service_healthy`.
- `api` and `web` Dockerfiles (multi-stage) suitable for both local and the CI `docker build` job.
- `infra/README.md` with up/down/reset/seed commands.
- MinIO bucket bootstrap; DB migrate on `api` start in dev mode.

**Out of scope:**
- Mobile (runs on host via `flutter run`).
- Kubernetes / cloud manifests.

## Acceptance Criteria

- [ ] `docker compose -f infra/docker-compose.yml up -d` reaches all services `healthy`.
- [ ] `GET localhost:3000/v1/health` returns 200 `{ db: "up" }` from the composed stack.
- [ ] The web container serves the login page.
- [ ] Stopping `postgres` makes `/v1/health` return 503; restarting recovers it.
- [ ] `infra/README.md` reset command drops and recreates the dev database.
- [ ] No service requires an internet credential to start.

## Dependencies

- T-0001, T-0002

## Implementation Checklist

- [ ] Author `api` and `web` multi-stage Dockerfiles.
- [ ] Write `infra/docker-compose.yml` with all six services + healthchecks.
- [ ] Add MinIO bucket bootstrap + dev DB migrate step.
- [ ] Write `infra/README.md` (up / down / reset / seed).
- [ ] Verify against every Acceptance Criteria row.

## Verification

- Command: `docker compose -f infra/docker-compose.yml up -d && curl -fsS localhost:3000/v1/health && curl -fsS localhost:8080 >/dev/null && echo OK`
- Evidence: `docker compose ps` (all healthy) + the two curl outputs pasted into the PR.
