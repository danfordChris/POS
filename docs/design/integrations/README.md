# Integrations — Inventory

## Context

- External dependencies the platform relies on. Each is wrapped behind an internal interface so it can be swapped.

## Requirements

| Integration | MVP? | Interface | Candidates |
|---|---|---|---|
| Transactional email | Yes | `EmailSender.send(template, to, vars)` | Amazon SES, Resend, Postmark |
| Object storage (product images) | Yes | `FileStore.put/get/url` | Amazon S3, Cloudflare R2, MinIO (local) |
| Job queue / scheduler | Yes | `Queue.enqueue/process` | BullMQ + Redis |
| Push notifications | No (post-MVP) | `Push.send` | Firebase Cloud Messaging |
| SMS | No (post-MVP) | `SmsSender.send` | NextSMS (nextsms.co.tz) — selected; Beem / Africa's Talking as fallback |
| Mobile money / payments | No (post-MVP) | `PaymentProvider` | M-Pesa (Vodacom), Tigo Pesa, Airtel Money |
| Fiscal receipts (EFD/VFD) | No (post-MVP) | `FiscalDevice` | TRA VFD integration |

## Decisions

- Every integration has a `local` implementation (MinIO, in-memory email capture, local Redis) so the full stack runs offline for development.
- Provider selection is environment config, not code.
- All services ship as Docker images; deployment target is any container platform + managed Postgres + managed Redis.

## Contracts

- No business logic in provider adapters; they only translate to/from the internal interface.
- Secrets via environment/secret manager, never committed.

## Acceptance Criteria

- Local stack runs with zero external SaaS accounts.
- Swapping the email provider requires only config + one adapter file.
