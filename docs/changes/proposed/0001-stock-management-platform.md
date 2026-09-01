# Stock Management Platform — Residual Open Items

## Status

proposed

## Context

- Product idea, MVP boundary, and foundational choices approved 2026-09-01 and promoted into `docs/design/`.
- Backend (NestJS + PostgreSQL + Prisma), containerized hosting, git init, and SMS provider (NextSMS) resolved 2026-09-01 and folded into `docs/design/decisions/0001-foundational-choices.md`.
- This doc now tracks only what is still unresolved.

## Problem

- One post-MVP choice remains open. It does not block any MVP phase.

## Proposed Change

- Payments / mobile money provider shortlist (M-Pesa Vodacom, Tigo Pesa, Airtel Money): evaluate and pick when the post-MVP payments phase is scoped. Capture the decision in `docs/design/decisions/` and add a `PaymentProvider` adapter section to `docs/design/integrations/README.md` at that time.

## Expected Design Impact

- Future decision doc + `integrations/README.md` update when payments are scoped.

## Expected Implementation Impact

- None for MVP Phases 00–05.
