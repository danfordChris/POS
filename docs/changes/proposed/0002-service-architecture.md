# Service Architecture — Closed

## Status

on-hold

## Context

- **Option B — microservices from day one** decided and adopted 2026-09-01.
- All defaults confirmed 2026-09-01 and recorded in `docs/design/decisions/0002-microservices.md`:
  NATS + JetStream, NATS request/reply for sync calls, one shared Postgres (schema per
  service; revised 2026-09-02), Kubernetes,
  gateway-only edge auth with a signed internal context.
- Design docs and the implementation plan (Phase 01 — Platform; features renumbered 02–06) are updated.

## Problem

- Nothing outstanding. One item deferred, not blocking.

## Proposed Change

- Deferred to Phase 06: service mesh (mTLS via Linkerd/Istio) vs. plain Kubernetes `NetworkPolicy` + internal-context signing.

## Expected Design Impact

- None until the Phase 06 mesh decision.

## Expected Implementation Impact

- None. Phase 01 proceeds against the confirmed defaults.
