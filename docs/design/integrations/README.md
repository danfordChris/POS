# Integrations — Inventory

## Context

- External dependencies the platform relies on. Each is wrapped behind an internal interface so it can be swapped.

## Requirements

| Integration | MVP? | Interface | Candidates |
|---|---|---|---|
| Message broker (events + RPC) | Yes | NATS client in `@pos/nest-common` | NATS + JetStream (selected); RabbitMQ fallback |
| Transactional email | Yes | `EmailSender.send(template, to, vars)` | Amazon SES, Resend, Postmark |
| Object storage (product images) | Yes | `FileStore.put/get/url` | Amazon S3, Cloudflare R2, MinIO (local) |
| Cache / retry queue (per service) | Yes | `Queue.enqueue/process` | Redis (gateway membership cache, notifications retries) |
| Container orchestration | Yes | Helm charts / manifests in `infra/k8s` | Kubernetes (prod); docker-compose (local) |
| Push notifications | No (post-MVP) | `Push.send` | Firebase Cloud Messaging |
| SMS | No (post-MVP) | `SmsSender.send` | NextSMS (nextsms.co.tz) — selected; Beem / Africa's Talking as fallback |
| Mobile money / payments | No (post-MVP) | `PaymentProvider` | M-Pesa (Vodacom), Tigo Pesa, Airtel Money |
| Fiscal receipts (EFD/VFD) | No (post-MVP) | `FiscalDevice` | TRA VFD integration |

## Decisions

- Every integration has a `local` implementation (NATS container, MinIO, Mailpit, local Redis) so the full stack runs offline for development.
- Provider selection is environment config, not code.
- Every service ships as its own Docker image; production runs on Kubernetes with one managed Postgres instance (a schema + role per service).

## Contracts

- No business logic in provider adapters; they only translate to/from the internal interface.
- Secrets via environment/secret manager, never committed.

## Acceptance Criteria

- Local stack runs with zero external SaaS accounts.
- Swapping the email provider requires only config + one adapter file.
