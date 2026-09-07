# T-0605 `media` Service — Invoice PDF Rendering + Storage

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 07 — Invoicing and Credit Sales

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/product/invoicing-and-credit.md` (PDF section),
  `docs/design/architecture/service-decomposition.md` (`media` row, deployment,
  `media` schema + MinIO), `docs/design/interfaces/events-catalog.md`
  (`InvoiceIssued` in, `InvoiceDocumentReady` out; `MEDIA` stream),
  `docs/design/interfaces/internal-rpc.md` (`pos.rpc.media.renderInvoice`),
  `docs/design/data/data-model.md` (`document`)
- Constraints: **new service** following the existing `services/*` layout —
  `@pos/nest-common` `configureApp`, `HealthModule`, outbox + `subscribeWithDlq`
  + idempotent-consumer helpers, `runInTenantContext`; `document` is a tenant
  table with forced RLS; object storage is MinIO locally (S3 in prod) via the
  existing `infra` MinIO bucket; PDF is rendered from an HTML template (headless
  Chromium or a pure-Node PDF lib — pick one that containerises cleanly and
  document the choice); the render consumes the `InvoiceIssued` payload directly
  (no cross-service DB read); `renderInvoice` RPC re-renders on demand.
- Do not touch: `sales` beyond consuming its events / serving it the RPC
  response; `web`, `mobile`.

## Objective

A new `media` service renders each issued invoice to a stored PDF, emits
`InvoiceDocumentReady`, and serves the PDF through Kong at
`GET /v1/businesses/{id}/invoices/{id}/pdf` and public `GET /v1/i/{token}/pdf`
(`202` until the document exists).

## Scope Boundary

**In scope:**
- `services/media/` — Nest app, Prisma schema (`Document`), migration + forced
  RLS, Dockerfile (multi-stage; whatever the renderer needs), `/healthz` +
  `/readyz` (DB + NATS + object store).
- `InvoiceIssuedConsumer` — `subscribeWithDlq`, idempotent on `event_id`,
  deduped on `invoice_id`; renders HTML→PDF, puts the object in MinIO/S3
  (`invoices/{business_id}/{invoice_id}.pdf`), upserts the `document` row,
  writes `InvoiceDocumentReady` to the outbox.
- `pos.rpc.media.renderInvoice` handler — re-render + replace the object +
  `document` row + emit `InvoiceDocumentReady`; `not_found` if the caller passes
  an unknown invoice snapshot.
- HTTP: `GET /v1/businesses/{businessId}/invoices/{id}/pdf` (member context) and
  `GET /v1/i/{token}/pdf` (no auth) — look up the `document` row, stream the
  object (or 302 to a signed URL); `202` + `Retry-After: 2` when absent.
- Kong routes for both `/pdf` paths (`/v1/i/{token}/pdf` with
  `require_business_scope: false`) in `infra/kong/kong.yml` +
  `infra/k8s/base/kong-config.yaml`.
- `infra/docker-compose.yml` `media` service + env; `infra/k8s/base` manifests
  (`Deployment`, `Service`, HPA, PDB, config/secret) + kustomization entry.
- `.github/workflows/ci.yml` — add `media` to the `service` matrix (schema,
  `MEDIA_DATABASE_URL`) and to the acceptance job's migrate list + readiness
  wait.
- `.env.example` — `MEDIA_PORT`, `MEDIA_DATABASE_URL`, object-store vars.
- e2e specs (`services/media`): consumer renders + stores + emits; idempotency;
  the `/pdf` `202`→`200` transition; RLS on `document`.

**Out of scope:**
- Receipt PDFs, statement PDFs (backlog).
- `sales` copying `document_url` onto the invoice — that consumer is in T-0604's
  service but the `InvoiceDocumentReady` handler can be added here-or-there;
  put it in `sales` under this task only if trivial, else note it for T-0609.
- Web/mobile download buttons (T-0607/T-0608).

## Acceptance Criteria

- `services/media` builds, tests, lints, and containerises on its own; the CI
  `service (media)` job runs its suite.
- An `InvoiceIssued` event produces exactly one stored object and one
  `document` row; a duplicate delivery (same `event_id`) produces no second
  object and no second `InvoiceDocumentReady`.
- `GET /v1/businesses/{id}/invoices/{id}/pdf` returns `202` + `Retry-After`
  before the document exists and a `200 application/pdf` after
  `InvoiceDocumentReady`; `GET /v1/i/{token}/pdf` does the same with no
  `Authorization` header and `404` for an unknown/void token.
- A `document` query with no `app.business_id` set returns zero rows (forced
  RLS).
- `pos.rpc.media.renderInvoice` re-renders and re-emits `InvoiceDocumentReady`.
- `kong config parse` OK; `kubectl kustomize infra/k8s/base` renders with the
  `media` manifests; `docker compose config` valid; `check-contracts-compat.mjs
  HEAD` OK; `validate_workflow.py` → `WORKFLOW:ok`.

## Dependencies

- T-0601 (`InvoiceIssued`, `InvoiceDocumentReady`, `renderInvoice` contracts),
  T-0603 (issued invoices to consume).

## Implementation Checklist

1. Scaffold `services/media` (Nest, Prisma `Document`, migration + RLS, health,
   Dockerfile).
2. Object-store client (MinIO/S3) + HTML invoice template + renderer.
3. `InvoiceIssuedConsumer` (render → store → `document` upsert → outbox
   `InvoiceDocumentReady`); `renderInvoice` RPC handler.
4. `/pdf` controllers (member + public) with the `202` path.
5. Kong routes; compose service; k8s manifests + kustomization; CI matrix +
   acceptance wiring; `.env.example`.
6. e2e; build/test/lint; kong parse; kustomize; compose config; compat;
   validator.

## Verification

_Planned — to be filled on completion:_

- `pnpm --filter @pos/media test build lint`.
- `docker compose -f infra/docker-compose.yml config` + `kubectl kustomize
  infra/k8s/base` + `kong config parse`.
- Live smoke: issue an invoice → poll `/v1/i/{token}/pdf` `202`→`200`; check the
  object in MinIO.
- `node scripts/check-contracts-compat.mjs HEAD`; `validate_workflow.py` →
  `WORKFLOW:ok`.
