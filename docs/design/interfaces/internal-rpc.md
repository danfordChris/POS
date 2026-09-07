# Internal RPC

## Context

- Synchronous inter-service calls over NATS request/reply. Subject: `pos.rpc.<context>.<Method>`.
- Used only where the caller cannot own an eventually-consistent copy of the data. Everything else is events.
- Request/response schemas live in `@pos/contracts`. Timeout 2s default; caller handles `503 upstream_unavailable`.

## Requirements

### Call index (MVP)

| Subject | Caller | Request | Response | Notes |
|---|---|---|---|---|
| `pos.rpc.identity.getUser` | tenancy, winger | `{ email? , phone? , user_id? , create? }` | `{ user_id, name, email?, phone?, disabled }` or `not_found` | resolve/lookup a user identity; with `create: true` and an `email`/`phone` that matches nobody, provisions a passwordless shell user and returns it |
| `pos.rpc.identity.verifyToken` | gateway (fallback only) | `{ access_token }` | `{ valid, sub, aud, typ }` | gateway normally verifies locally with the shared key |
| `pos.rpc.tenancy.resolveMembership` | gateway, winger | `{ business_id, user_id }` | `{ found, role, status }` | per data-plane request; gateway caches 30–60s; busted by `MembershipSuspended`; `winger` calls it once when authorizing a winger to enforce member/winger mutual exclusion |
| `pos.rpc.inventory.reserveStock` | sales | `{ business_id, reservation_id, lines: [{ product_id, quantity }] }` | `{ ok }` or `{ ok:false, shortfalls: [...] }` | idempotent on `reservation_id` |
| `pos.rpc.inventory.commitReservation` | sales | `{ business_id, reservation_id, sale_id }` | `{ ok }` | also driven by `SaleCompleted` as backstop |
| `pos.rpc.inventory.releaseReservation` | sales | `{ business_id, reservation_id }` | `{ ok }` | saga compensation; idempotent |
| `pos.rpc.media.renderInvoice` | sales | `{ business_id, invoice_id }` | `{ url, bytes, sha256 }` or `not_found` | on-demand PDF regeneration; the normal path is the `InvoiceIssued` event, so callers tolerate `503` and fall back to the async result |

### Internal context

Every RPC request (and every gateway→service HTTP forward) carries a signed internal context header/metadata:

```
{ request_id, user_id, business_id | null, role | null, token_kind: "user" | "operator" | "system" }
```

- Signed by the gateway (HMAC with a rotating internal key, or a 60s internal JWT).
- Services reject a missing/invalid/expired context. `identity` accepts `business_id: null`.
- Service-to-service calls not originating from a user request (e.g. saga steps) use `token_kind: "system"` and set `business_id` explicitly.

## Decisions

- One messaging substrate (NATS) for both events and RPC; no separate gRPC stack in MVP.
- RPC responses never include another tenant's data; every handler runs tenant-scoped.
- If an RPC would need a join across two services, redesign toward an event-fed local copy instead.

## Contracts

- RPC is request/reply only — no fire-and-forget disguised as RPC (use events).
- Callers treat RPC failure as retryable with backoff, except validation errors.
- Adding a field is compatible; removing/renaming needs a new subject version.

## Acceptance Criteria

- Each subject has request + response zod schemas and a contract test.
- `reserveStock` / `releaseReservation` proven idempotent under duplicate delivery.
- A dropped `inventory` service makes `sales.createSale` fail cleanly with `503`, no partial sale.
- A request with a tampered internal context is rejected by the receiving service.
